const fs = require("fs");
const prisma = require("../config/prisma");
const cloudinary = require("../config/cloudinary");
const { getMessageType, ALLOWED } = require("../middleware/upload");
const { toPayload, touchConversation } = require("../socket/message.socket");
const sanitizeMessage = require("../utils/sanitizeMessage"); // NEW
const { getPlanUser, limitsFor } = require("../services/plans");

const SENDER_SELECT = { id: true, name: true, avatarUrl: true };
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Stops the function and sends this error to the user
const fail = (status, error) => {
  throw Object.assign(new Error(error), { status });
};

const sendError = (res, error, label) => {
  if (error.status) {
    return res
      .status(error.status)
      .json({ error: error.message, ...(error.code ? { code: error.code, feature: error.feature } : {}) });
  }
  console.error(label, error);
  return res.status(500).json({ error: "Internal server error" });
};

// NEW: reads the "view once" toggle (FormData sends it as the string "true")
const wantsViewOnce = (value) => value === true || value === "true";

// View-once is supported for photos, videos, and voice messages.
const canBeViewOnce = (messageType) =>
  ["IMAGE", "VIDEO", "AUDIO"].includes(messageType);

// View-once media has no caption: the text would stay visible after the media is gone
const captionFor = (body, viewOnce) =>
  !viewOnce && typeof body === "string" && body.trim() ? body.trim() : null;

// Free: 10 MB per file, Plus: 50 MB. 402 tells the app to show the Upgrade window.
const checkFileSize = async (userId, bytes) => {
  const { maxFileMB } = limitsFor(await getPlanUser(userId));
  if (bytes > maxFileMB * 1024 * 1024) {
    throw Object.assign(new Error(`Files over ${maxFileMB} MB need Talkora Plus`), {
      status: 402,
      code: "PLUS_REQUIRED",
      feature: "Large files",
    });
  }
};

// Finds the direct conversation between two users, or creates it
const findOrCreateConversation = async (userA, userB) =>
  (await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: userA } } },
        { members: { some: { userId: userB } } },
      ],
    },
    include: { members: true },
  })) ||
  prisma.conversation.create({
    data: { type: "DIRECT", members: { create: [{ userId: userA }, { userId: userB }] } },
    include: { members: true },
  });

// Works out which chat a file belongs to: group (conversationId) or direct (receiverId)
const resolveChat = async (senderId, { receiverId, conversationId }) => {
  if (conversationId !== undefined && conversationId !== null) {
    const id = Number(conversationId);
    if (!Number.isInteger(id)) fail(400, "conversationId must be a valid number");

    const conversation = await prisma.conversation.findFirst({
      where: { id, type: "GROUP", members: { some: { userId: senderId } } },
      include: { members: { select: { userId: true } } },
    });
    if (!conversation) fail(403, "Group not found or you are not a member");

    return { conversation, groupMemberIds: conversation.members.map((m) => m.userId) };
  }

  const to = Number(receiverId);
  if (!Number.isInteger(to)) fail(400, "receiverId must be a valid number");
  if (senderId === to) fail(400, "You cannot send a message to yourself");
  if (!(await prisma.user.findUnique({ where: { id: to } }))) fail(404, "Receiver not found");

  return { conversation: await findOrCreateConversation(senderId, to), to };
};

// Saves a file message and delivers it live (same events as text messages)
const saveAndDeliver = async (req, { conversation, groupMemberIds, to }, fileData) => {
  const senderId = req.user.id;

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId, receiverId: to ?? null, ...fileData },
    include: { sender: { select: SENDER_SELECT } },
  });

  await touchConversation(conversation.id, message.createdAt);

  const payload = groupMemberIds
    ? {
        ...toPayload(
          message,
          null,
          message.sender?.name || "User",
          message.sender?.avatarUrl || null
        ),
        conversationType: "GROUP",
        conversationName: conversation.name,
      }
    : toPayload(message);

  // NEW: for view-once messages, remove the real file link before sending to anyone
  const forViewer = (viewerId) =>
    message.viewOnce
      ? {
          ...payload,
          fileUrl: null,
          fileName: null,
          fileSize: null,
          viewOnce: true,
          viewOnceState: viewerId === senderId ? "SENT" : "UNOPENED",
        }
      : payload;

  const io = req.app.get("io");
  io.to(`user:${senderId}`).emit("messageSent", forViewer(senderId)); // sender (all open tabs)
  (groupMemberIds ? groupMemberIds.filter((id) => id !== senderId) : [to]).forEach((id) =>
    io.to(`user:${id}`).emit("newMessage", forViewer(id))
  );

  return forViewer(senderId);
};

// ==========================================
// TEXT MESSAGE (REST)
// ==========================================

const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, body } = req.body;

    if (!receiverId) fail(400, "receiverId is required");

    const to = Number(receiverId);
    if (!Number.isInteger(to)) fail(400, "receiverId must be a valid number");
    if (!body || !body.trim()) fail(400, "Message body is required");
    if (senderId === to) fail(400, "You cannot send a message to yourself");
    if (!(await prisma.user.findUnique({ where: { id: to } }))) fail(404, "Receiver not found");

    const conversation = await findOrCreateConversation(senderId, to);

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        receiverId: to,
        body: body.trim(),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    return res.status(201).json({
      message: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        body: message.body,
        messageType: message.messageType,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    return sendError(res, error, "REST send message error:");
  }
};

// ==========================================
// FILE MESSAGE: photo / video / document / voice note
// ==========================================

const sendFileMessage = async (req, res) => {
  const file = req.file;

  try {
    if (!file) fail(400, "No file uploaded");
    await checkFileSize(req.user.id, file.size);

    const { body, duration } = req.body;
    const chat = await resolveChat(req.user.id, req.body);

    const messageType = getMessageType(file.mimetype); // NEW: stored in a variable
    const viewOnce = wantsViewOnce(req.body.viewOnce) && canBeViewOnce(messageType);

    const payload = await saveAndDeliver(req, chat, {
      body: captionFor(body, viewOnce), // optional caption
      messageType,
      fileUrl: `/uploads/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      duration: Number(duration) > 0 ? Math.round(Number(duration)) : null, // voice notes
      viewOnce,
    });

    return res.status(201).json({ message: payload });
  } catch (error) {
    if (file) fs.unlink(file.path, () => {}); // delete the saved file if something went wrong
    return sendError(res, error, "REST send file message error:");
  }
};

// ==========================================
// FILE MESSAGE: already uploaded to Cloudinary
// ==========================================

const sendCloudinaryFile = async (req, res) => {
  try {
    const { publicId, fileName, mimeType } = req.body;

    const isText = (value) => typeof value === "string" && value.trim();
    if (![publicId, fileName, mimeType].every(isText) || !ALLOWED.includes(mimeType)) {
      fail(400, "Invalid file details");
    }

    const messageType = getMessageType(mimeType);
    const resourceType = { IMAGE: "image", VIDEO: "video" }[messageType] || "raw";

    const chat = await resolveChat(req.user.id, req.body);

    let asset;
    try {
      asset = await cloudinary.api.resource(publicId.trim(), { resource_type: resourceType });
    } catch (error) {
      if (error.http_code === 404) fail(404, "Cloudinary file not found");
      throw error;
    }

    if (
      !asset.secure_url ||
      asset.resource_type !== resourceType ||
      !Number.isInteger(asset.bytes) ||
      asset.bytes > MAX_FILE_SIZE
    ) {
      fail(400, "Cloudinary file is invalid or too large");
    }

    try {
      await checkFileSize(req.user.id, asset.bytes);
    } catch (error) {
      // don't keep a file the user isn't allowed to send
      cloudinary.uploader.destroy(asset.public_id, { resource_type: resourceType }).catch(() => {});
      throw error;
    }

    const viewOnce = wantsViewOnce(req.body.viewOnce) && canBeViewOnce(messageType);

    const payload = await saveAndDeliver(req, chat, {
      body: captionFor(req.body.body, viewOnce),
      messageType,
      fileUrl: asset.secure_url,
      fileName: fileName.trim(),
      fileSize: asset.bytes,
      mimeType,
      viewOnce,
    });

    return res.status(201).json({ message: payload });
  } catch (error) {
    return sendError(res, error, "REST send Cloudinary file error:");
  }
};

// ==========================================
// GET MESSAGES (REST)
// ==========================================

const getMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = Number(req.params.userId || req.query.userId);

    if (!Number.isInteger(otherUserId)) fail(400, "Invalid user ID");
    if (currentUserId === otherUserId) {
      fail(400, "You cannot open a conversation with yourself");
    }
    if (!(await prisma.user.findUnique({ where: { id: otherUserId } }))) {
      fail(404, "User not found");
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        type: "DIRECT",
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
    });

    if (!conversation) return res.json({ conversationId: null, messages: [] });

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      include: { views: { select: { userId: true } } }, // NEW
    });

    return res.json({
      conversationId: conversation.id,
      messages: messages.map((m) => sanitizeMessage(m, currentUserId)), // NEW
    });
  } catch (error) {
    return sendError(res, error, "REST get messages error:");
  }
};

module.exports = {
  sendMessage,
  sendFileMessage,
  sendCloudinaryFile,
  getMessages,
};