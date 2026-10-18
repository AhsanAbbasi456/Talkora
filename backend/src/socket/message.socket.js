const prisma = require("../config/prisma");
const sanitizeMessage = require("../utils/sanitizeMessage"); // NEW

// ==========================================
// HELPERS
// ==========================================
const { askAi } = require("../services/aiBot");
const { bot } = require("../services/botAccount"); // bot.id = the Talkora AI account
const MENTION = /@talkora\s*ai/i;
const SENDER_SELECT = { id: true, name: true, avatarUrl: true };
const FILE_LABELS = { IMAGE: "📷 Photo", VIDEO: "🎥 Video", DOCUMENT: "📄 Document", POLL: "📊 Poll", AUDIO: "🎤 Voice message" };
// How we load a poll together with its options and who voted
const POLL_INCLUDE = {
  options: {
    orderBy: { sort: "asc" },
    include: { votes: { select: { userId: true } } },
  },
};

// Turn a poll from the database into the shape the frontend uses
const formatPoll = (poll) =>
  poll
    ? {
        id: poll.id,
        question: poll.question,
        allowMultiple: poll.allowMultiple,
        closed: poll.closed,
        options: poll.options.map((o) => ({
          id: o.id,
          text: o.text,
          voterIds: o.votes.map((v) => v.userId),
        })),
      }
    : null;

const emitError = (socket, message) => socket.emit("messageError", { error: message });
const isInt = (value) => Number.isInteger(Number(value));
const has = (value) => value !== undefined && value !== null;
const cleanBody = (value) => (typeof value === "string" ? value.trim() : "");

// Text shown in reply previews (file messages without a caption get a label)
const previewText = (message) => message?.body || FILE_LABELS[message?.messageType] || null;

// Send one event to many users
const sendTo = (io, userIds, event, payload) =>
  userIds.forEach((id) => io.to(`user:${id}`).emit(event, payload));

const safe = (socket, name, handler) => async (data) => {
  try {
    await handler(data || {});
  } catch (error) {
    console.error(`Socket ${name} error:`, error);
    emitError(socket, "Internal server error");
  }
};

// ==========================================
// CONVERSATION HELPERS
// ==========================================

const findConversation = (userA, userB, include) =>
  prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: userA } } },
        { members: { some: { userId: userB } } },
      ],
    },
    include,
  });

const findGroupConversation = (conversationId, userId, include) =>
  prisma.conversation.findFirst({
    where: { id: conversationId, type: "GROUP", members: { some: { userId } } },
    include,
  });

const findOrCreateDirect = async (userA, userB) =>
  (await findConversation(userA, userB)) ||
  prisma.conversation.create({
    data: {
      type: "DIRECT",
      members: { create: [{ userId: userA }, { userId: userB }] },
    },
  });

const getGroupMemberIds = async (conversationId) =>
  (
    await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    })
  ).map((member) => member.userId);

const isGroup = async (conversationId) =>
  Boolean(await prisma.conversation.findFirst({ where: { id: conversationId, type: "GROUP" } }));

// Who should be told about a change to this message
const audience = async (message) =>
  (await isGroup(message.conversationId))
    ? getGroupMemberIds(message.conversationId)
    : [message.senderId, message.receiverId].filter(Boolean);

const touchConversation = async (conversationId, at) => {
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: at } });
  await prisma.conversationMember.updateMany({
    where: { conversationId, hidden: true },
    data: { hidden: false },
  });
};

// ==========================================
// MESSAGE HELPERS
// ==========================================

const toPayload = (message, replyToText = null, senderName = null, senderAvatarUrl = null) => ({
  id: message.id,
  conversationId: message.conversationId,
  senderId: message.senderId,
  receiverId: message.receiverId,
  body: message.body,
  createdAt: message.createdAt,
  editedAt: message.editedAt,
  replyToId: message.replyToId,
  replyToText,
  senderName,
  senderAvatarUrl,
  deletedForEveryone: message.deletedForEveryone,

  // File fields (photo / video / document)
  messageType: message.messageType,
  // NEW: view-once messages NEVER expose their real file link
  fileUrl: message.viewOnce ? null : message.fileUrl,
  fileName: message.viewOnce ? null : message.fileName,
  fileSize: message.viewOnce ? null : message.fileSize,
  mimeType: message.mimeType,
  duration: message.duration,

  // NEW: view-once info for the frontend
  viewOnce: Boolean(message.viewOnce),
  viewOnceState: message.viewOnce ? (message.mediaExpired ? "EXPIRED" : "UNOPENED") : null,

  // Poll (null for normal messages)
  poll: message.poll ? formatPoll(message.poll) : null,
});

// Messages deleted for everyone must not leak their text or file
const hideIfDeleted = (message) =>
  message.deletedForEveryone
    ? { ...message, body: "", fileUrl: null, fileName: null, poll: null }
    : message;

const getReplyText = async (replyToId) =>
  replyToId ? previewText(await prisma.message.findUnique({ where: { id: replyToId } })) : null;

// Loads a message only if this user is allowed to touch it
const getMyMessage = async (socket, messageId) => {
  const me = Number(socket.userId);
  const message = await prisma.message.findUnique({ where: { id: messageId } });

  if (!message) {
    emitError(socket, "Message not found");
    return null;
  }

  if (await findGroupConversation(message.conversationId, me)) return message;

  if (message.senderId !== me && message.receiverId !== me) {
    emitError(socket, "Not allowed");
    return null;
  }

  return message;
};

// All visible messages of a conversation for one user
const fetchMessages = async (conversation, me) => {
  const clearedAt = conversation.members.find((member) => member.userId === me)?.clearedAt;

  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      ...(clearedAt ? { createdAt: { gt: clearedAt } } : {}),
      NOT: { deletedFor: { has: me } },
    },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: SENDER_SELECT },
      poll: { include: POLL_INCLUDE },
      views: { select: { userId: true } }, // NEW
    },
  });

  return messages.map((message) =>
    // NEW: sanitizeMessage hides the file link and sets viewOnceState for this user
    sanitizeMessage(
      {
        ...hideIfDeleted(message),
        poll: message.deletedForEveryone ? null : formatPoll(message.poll),
        senderName: message.sender?.name || "User",
        senderAvatarUrl: message.sender?.avatarUrl || null,
      },
      me
    )
  );
};
// When someone writes to the Talkora AI chat, the bot answers
const replyFromBot = async (io, conversationId, userId) => {
  const room = `user:${userId}`;
  io.to(room).emit("typing", { userId: bot.id, isTyping: true });

  const botMessage = await askAi(conversationId, userId, userId);

  io.to(room).emit("typing", { userId: bot.id, isTyping: false });
  io.to(room).emit("newMessage", toPayload(botMessage));
};
// Someone wrote @Talkora AI inside a normal chat: the bot answers there
// receiverId is null for groups
const replyToMention = async (io, conversation, receiverId, memberIds, askerId) => {
  const botMessage = await askAi(conversation.id, receiverId, askerId);

  sendTo(io, memberIds, "newMessage", {
    ...toPayload(botMessage, null, "Talkora AI"),
    ...(receiverId === null
      ? { conversationType: "GROUP", conversationName: conversation.name }
      : {}),
  });
};
// Create + save + deliver a direct text message (used by send and reply)
const deliverDirect = async (io, socket, conversation, to, body, replyTarget = null) => {
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: Number(socket.userId),
      receiverId: to,
      body,
      replyToId: replyTarget?.id,
    },
  });

  await touchConversation(conversation.id, message.createdAt);

  const payload = toPayload(message, replyTarget ? previewText(replyTarget) : null);
  socket.emit("messageSent", payload);
  io.to(`user:${to}`).emit("newMessage", payload);
     if (to === bot.id) {
    replyFromBot(io, conversation.id, Number(socket.userId)).catch((e) =>
      console.error("Talkora AI error:", e)
    );
    } else if (MENTION.test(body) || replyTarget?.senderId === bot.id) {
    const askerId = Number(socket.userId);
    replyToMention(io, conversation, askerId, [askerId, to], askerId).catch((e) =>
      console.error("Talkora AI error:", e)
    );
  }
};

// ==========================================
// SOCKET EVENTS
// ==========================================

const registerMessageSocket = (io, socket) => {
  const me = Number(socket.userId);

  // ------------------------------------------
  // TYPING
  // ------------------------------------------

  socket.on("typing", (data) => {
    const receiverId = Number(data?.receiverId);
    const isTyping = Boolean(data?.isTyping);

    if (Number.isInteger(receiverId)) {
      return io.to(`user:${receiverId}`).emit("typing", { userId: me, isTyping });
    }

    const conversationId = Number(data?.conversationId);
    if (!Number.isInteger(conversationId)) return;

    findGroupConversation(conversationId, me)
      .then(async (group) => {
        if (!group) return;
        const memberIds = await getGroupMemberIds(conversationId);
        sendTo(
          io,
          memberIds.filter((id) => id !== me),
          "typing",
          { userId: me, conversationId, isTyping }
        );
      })
      .catch((error) => console.error("Group typing error:", error));
  });

  // ------------------------------------------
  // SEND MESSAGE
  // DIRECT: { receiverId, body }   GROUP: { conversationId, body }
  // ------------------------------------------

  socket.on(
    "sendMessage",
    safe(socket, "send message", async (data) => {
      const body = cleanBody(data.body);
      if (!body) return emitError(socket, "Message body is required");

      // GROUP
      if (has(data.conversationId)) {
        const groupId = Number(data.conversationId);
        if (!isInt(groupId)) return emitError(socket, "conversationId must be a valid number");

        const conversation = await findGroupConversation(groupId, me);
        if (!conversation) return emitError(socket, "Group not found or you are not a member");

        // receiverId is NULL for group messages
        const message = await prisma.message.create({
          data: { conversationId: conversation.id, senderId: me, receiverId: null, body },
          include: { sender: { select: SENDER_SELECT } },
        });

        await touchConversation(conversation.id, message.createdAt);

        const payload = {
          ...toPayload(
            message,
            null,
            message.sender?.name || "User",
            message.sender?.avatarUrl || null
          ),
          conversationType: "GROUP",
          conversationName: conversation.name,
        };

        socket.emit("messageSent", payload);

        const memberIds = await getGroupMemberIds(conversation.id);
                sendTo(io, memberIds.filter((id) => id !== me), "newMessage", payload);

        if (MENTION.test(body)) {
          replyToMention(io, conversation, null, memberIds, me).catch((e) =>
            console.error("Talkora AI error:", e)
          );
        }
        return;
      }

      // DIRECT
      const to = Number(data.receiverId);
      if (!data.receiverId) return emitError(socket, "receiverId is required");
      if (!isInt(to)) return emitError(socket, "receiverId must be a valid number");
      if (me === to) return emitError(socket, "You cannot send a message to yourself");

      const receiver = await prisma.user.findUnique({ where: { id: to } });
      if (!receiver) return emitError(socket, "Receiver not found");

      const conversation = await findOrCreateDirect(me, to);
      await deliverDirect(io, socket, conversation, to, body);
    })
  );

  // ------------------------------------------
  // CREATE POLL
  // DIRECT: { receiverId, question, options, allowMultiple }
  // GROUP:  { conversationId, question, options, allowMultiple }
  // ------------------------------------------

  socket.on(
    "createPoll",
    safe(socket, "create poll", async (data) => {
      const question = cleanBody(data.question);
      const options = Array.isArray(data.options)
        ? [...new Set(data.options.map(cleanBody).filter(Boolean))]
        : [];

      if (!question) return emitError(socket, "Poll question is required");
      if (question.length > 200) return emitError(socket, "Question is too long (max 200)");
      if (options.length < 2) return emitError(socket, "Add at least 2 different options");
      if (options.length > 6) return emitError(socket, "You can add up to 6 options");
      if (options.some((o) => o.length > 100)) {
        return emitError(socket, "An option is too long (max 100)");
      }

      const isGroupPoll = has(data.conversationId);
      let conversation;
      let to = null;

      if (isGroupPoll) {
        const groupId = Number(data.conversationId);
        if (!isInt(groupId)) return emitError(socket, "conversationId must be a valid number");

        conversation = await findGroupConversation(groupId, me);
        if (!conversation) return emitError(socket, "Group not found or you are not a member");
      } else {
        to = Number(data.receiverId);
        if (!isInt(to)) return emitError(socket, "receiverId must be a valid number");
        if (me === to) return emitError(socket, "You cannot send a poll to yourself");

        const receiver = await prisma.user.findUnique({ where: { id: to } });
        if (!receiver) return emitError(socket, "Receiver not found");

        conversation = await findOrCreateDirect(me, to);
      }

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: me,
          receiverId: to,
          body: question,
          messageType: "POLL",
          poll: {
            create: {
              question,
              allowMultiple: Boolean(data.allowMultiple),
              options: { create: options.map((text, index) => ({ text, sort: index })) },
            },
          },
        },
        include: {
          sender: { select: SENDER_SELECT },
          poll: { include: POLL_INCLUDE },
        },
      });

      await touchConversation(conversation.id, message.createdAt);

      const payload = {
        ...toPayload(
          message,
          null,
          message.sender?.name || "User",
          message.sender?.avatarUrl || null
        ),
        ...(isGroupPoll
          ? { conversationType: "GROUP", conversationName: conversation.name }
          : {}),
      };

      socket.emit("messageSent", payload);

      if (isGroupPoll) {
        const memberIds = await getGroupMemberIds(conversation.id);
        sendTo(io, memberIds.filter((id) => id !== me), "newMessage", payload);
      } else {
        io.to(`user:${to}`).emit("newMessage", payload);
      }
    })
  );
  // ------------------------------------------
  // VOTE ON POLL
  // { pollId, optionId }
  // Tap an option to vote, tap it again to remove your vote.
  // ------------------------------------------

  socket.on(
    "votePoll",
    safe(socket, "vote poll", async (data) => {
      const pollId = Number(data.pollId);
      const optionId = Number(data.optionId);

      if (!isInt(pollId) || !isInt(optionId)) return emitError(socket, "Invalid poll or option");

      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: { options: true },
      });

      if (!poll) return emitError(socket, "Poll not found");
      if (poll.closed) return emitError(socket, "This poll is closed");
      if (!poll.options.some((o) => o.id === optionId)) {
        return emitError(socket, "Option not found");
      }

      // makes sure I am allowed to see this chat
      const message = await getMyMessage(socket, poll.messageId);
      if (!message) return;
      if (message.deletedForEveryone) return emitError(socket, "This poll was deleted");

      const existing = await prisma.pollVote.findUnique({
        where: { optionId_userId: { optionId, userId: me } },
      });

      if (existing) {
        // tapped the same option again: remove my vote
        await prisma.pollVote.delete({ where: { id: existing.id } });
      } else if (poll.allowMultiple) {
        await prisma.pollVote.create({ data: { pollId, optionId, userId: me } });
      } else {
        // single choice: replace my old vote with the new one
        await prisma.$transaction([
          prisma.pollVote.deleteMany({ where: { pollId, userId: me } }),
          prisma.pollVote.create({ data: { pollId, optionId, userId: me } }),
        ]);
      }

      const updated = await prisma.poll.findUnique({
        where: { id: pollId },
        include: POLL_INCLUDE,
      });

      sendTo(io, await audience(message), "pollUpdated", {
        messageId: message.id,
        poll: formatPoll(updated),
      });
    })
  );
  // ------------------------------------------
  // GET MESSAGES
  // DIRECT: { userId }   GROUP: { conversationId }
  // ------------------------------------------

  socket.on(
    "getMessages",
    safe(socket, "get messages", async (data) => {
      let conversation;

      if (has(data.conversationId)) {
        const conversationId = Number(data.conversationId);
        if (!isInt(conversationId)) return emitError(socket, "Invalid conversation ID");

        conversation = await findGroupConversation(conversationId, me, { members: true });
        if (!conversation) return emitError(socket, "Group not found or you are not a member");
      } else {
        const otherId = Number(data.userId);
        if (!isInt(otherId)) return emitError(socket, "Invalid user ID");
        if (me === otherId) {
          return emitError(socket, "You cannot open a conversation with yourself");
        }

        const otherUser = await prisma.user.findUnique({ where: { id: otherId } });
        if (!otherUser) return emitError(socket, "User not found");

        conversation = await findConversation(me, otherId, { members: true });
      }

      socket.emit("messages", {
        conversationId: conversation?.id ?? null,
        messages: conversation ? await fetchMessages(conversation, me) : [],
      });
    })
  );

  // ------------------------------------------
  // MARK AS READ
  // ------------------------------------------

  socket.on(
    "markRead",
    safe(socket, "mark read", async (data) => {
      // GROUP
      if (has(data.conversationId)) {
        const conversationId = Number(data.conversationId);
        if (!isInt(conversationId)) return emitError(socket, "Invalid conversation ID");

        if (!(await findGroupConversation(conversationId, me))) {
          return emitError(socket, "Group not found or you are not a member");
        }

        await prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId: me } },
          data: { lastReadAt: new Date() },
        });
        return;
      }

      // DIRECT
      const senderId = Number(data.senderId);
      if (!isInt(senderId)) return emitError(socket, "Invalid sender ID");
      if (me === senderId) return;

      const conversation = await findConversation(me, senderId);
      if (!conversation) return;

      const readAt = new Date();
      const { count } = await prisma.message.updateMany({
        where: {
          conversationId: conversation.id,
          senderId,
          receiverId: me,
          readAt: null,
          deletedForEveryone: false,
        },
        data: { readAt },
      });

      if (count > 0) {
        io.to(`user:${senderId}`).emit("messagesRead", {
          readerId: me,
          readAt: readAt.toISOString(),
        });
      }
    })
  );

  // ------------------------------------------
  // REPLY MESSAGE
  // ------------------------------------------

  socket.on(
    "replyMessage",
    safe(socket, "reply message", async (data) => {
      const receiverId = Number(data.receiverId);
      const replyToId = Number(data.replyToId);
      const body = cleanBody(data.body);

      if (!isInt(receiverId)) return emitError(socket, "Invalid receiver ID");
      if (!body) return emitError(socket, "Message body is required");
      if (me === receiverId) return emitError(socket, "You cannot reply to yourself");
      if (!isInt(replyToId)) return emitError(socket, "Invalid reply target");

      const replyTarget = await prisma.message.findUnique({ where: { id: replyToId } });
      if (!replyTarget) return emitError(socket, "Message not found");

      const conversation = await findConversation(me, receiverId);
      if (!conversation) return emitError(socket, "Conversation not found");

      await deliverDirect(io, socket, conversation, receiverId, body, replyTarget);
    })
  );

  // ------------------------------------------
  // EDIT MESSAGE
  // ------------------------------------------

  socket.on(
    "editMessage",
    safe(socket, "edit message", async (data) => {
      const messageId = Number(data.messageId);
      const body = cleanBody(data.body);

      if (!isInt(messageId)) return emitError(socket, "Invalid message ID");
      if (!body) return emitError(socket, "Message body is required");

      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message) return emitError(socket, "Message not found");
      if (message.senderId !== me) return emitError(socket, "Not allowed");

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { body, editedAt: new Date() },
      });

      sendTo(io, await audience(updated), "messageEdited", {
        id: updated.id,
        messageId: updated.id,
        conversationId: updated.conversationId,
        body: updated.body,
        editedAt: updated.editedAt,
        senderId: updated.senderId,
        receiverId: updated.receiverId,
      });
    })
  );

  // ------------------------------------------
  // DELETE MESSAGE
  // ------------------------------------------

  socket.on(
    "deleteMessage",
    safe(socket, "delete message", async (data) => {
      const id = Number(data.messageId);
      const mode = data.mode;

      if (!isInt(id)) return emitError(socket, "Invalid message ID");
      if (mode !== "everyone" && mode !== "me") return emitError(socket, "Invalid delete mode");

      const message = await getMyMessage(socket, id);
      if (!message) return;

      // DELETE FOR EVERYONE
      if (mode === "everyone") {
        if (message.senderId !== me) {
          return emitError(socket, "You can only delete your own messages for everyone");
        }

        await prisma.message.update({
          where: { id },
          data: { deletedForEveryone: true, deletedAt: new Date() },
        });

        return sendTo(io, await audience(message), "messageDeleted", { messageId: id, mode });
      }

      // DELETE FOR ME
      if (!message.deletedFor.includes(me)) {
        await prisma.message.update({ where: { id }, data: { deletedFor: { push: me } } });
      }

      socket.emit("messageDeleted", { messageId: id, mode });
    })
  );

  // ------------------------------------------
  // UNDO DELETE
  // ------------------------------------------

  socket.on(
    "undoDeleteMessage",
    safe(socket, "undo delete message", async (data) => {
      const messageId = Number(data.messageId);
      const mode = data.mode;

      if (!isInt(messageId)) return emitError(socket, "Invalid message ID");
      if (mode !== "everyone" && mode !== "me") return emitError(socket, "Invalid undo mode");

      const message = await getMyMessage(socket, messageId);
      if (!message) return;

      let restored;

      if (mode === "everyone") {
        if (message.senderId !== me) {
          return emitError(socket, "Only the sender can undo delete for everyone");
        }
        if (!message.deletedForEveryone) {
          return emitError(socket, "Message is not deleted for everyone");
        }

        restored = await prisma.message.update({
          where: { id: messageId },
          data: { deletedForEveryone: false, deletedAt: null },
        });
      } else {
        if (!message.deletedFor.includes(me)) {
          return emitError(socket, "Message is not deleted for you");
        }

        restored = await prisma.message.update({
          where: { id: messageId },
          data: { deletedFor: message.deletedFor.filter((uid) => Number(uid) !== me) },
        });
      }

      const sender = await prisma.user.findUnique({
        where: { id: restored.senderId },
        select: SENDER_SELECT,
      });

      const payload = {
        ...toPayload(
          restored,
          await getReplyText(restored.replyToId),
          sender?.name || "User",
          sender?.avatarUrl || null
        ),
        messageId: restored.id,
        mode,
      };

      if (mode === "everyone") {
        sendTo(io, await audience(restored), "messageRestored", payload);
      } else {
        socket.emit("messageRestored", payload);
      }
    })
  );

  // ------------------------------------------
  // DELETE / CLEAR DIRECT CHAT
  // ------------------------------------------

  socket.on(
    "deleteChat",
    safe(socket, "delete chat", async (data) => {
      const otherId = Number(data.userId);
      const mode = data.mode;

      if (!isInt(otherId)) return emitError(socket, "Invalid user ID");
      if (mode !== "delete" && mode !== "clear") return emitError(socket, "Invalid mode");

      const conversation = await findConversation(me, otherId);
      if (!conversation) return emitError(socket, "Chat not found");

      await prisma.conversationMember.updateMany({
        where: { conversationId: conversation.id, userId: me },
        data: mode === "delete" ? { clearedAt: new Date(), hidden: true } : { clearedAt: new Date() },
      });

      socket.emit("chatDeleted", { userId: otherId, mode });
    })
  );
};

// ==========================================
// EXPORT
// ==========================================

module.exports = registerMessageSocket;

// Shared with the REST file-upload controller
module.exports.toPayload = toPayload;
module.exports.touchConversation = touchConversation;