const prisma = require("../config/prisma");

const userSelect = { id: true, name: true, email: true, avatarUrl: true, about: true, isOnline: true };

const formatDuration = (s = 0) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const FILE_PREVIEWS = { IMAGE: "📷 Photo", VIDEO: "🎥 Video" };

// Text shown under the chat name in the sidebar
const getLastMessagePreview = (message) => {
  if (!message) return null;
    if (message.deletedForEveryone) return "This message was deleted";

  // call messages: show the call type, not the status text (cancelled / completed)
  if (message.messageType === "CALL") {
        return message.fileName === "video" ? "Video call" : "Voice call";
  }

  if (message.body) return message.body;

  if (message.messageType === "DOCUMENT") {
    return `📄 ${message.fileName || "Document"}`;
  }
  if (message.messageType === "AUDIO") {
    return `🎤 ${formatDuration(message.duration || 0)}`;
  }

  return FILE_PREVIEWS[message.messageType] || null;
};

const formatMember = (member) => ({
  userId: member.userId,
  role: member.role,
  user: member.user,
});

// ==========================================
// GET /api/conversations
// ==========================================
async function getConversations(req, res) {
  try {
    const userId = req.user.id;

    const conversations = await prisma.conversation.findMany({
      where: { members: { some: { userId, hidden: false } } },
      include: {
        members: { include: { user: { select: userSelect } } },
        messages: {
          where: { NOT: { deletedFor: { has: userId } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    const result = conversations.map((conversation) => {
      const mine = conversation.members.find((m) => m.userId === userId);
      const other = conversation.members.find((m) => m.userId !== userId);

      let last = conversation.messages[0] ?? null;

      // respect "Clear chat"
      if (last && mine?.clearedAt && last.createdAt <= mine.clearedAt) last = null;

      const common = {
        conversationId: conversation.id,
        type: conversation.type,
        lastMessage: getLastMessagePreview(last),
                lastMessageAt: last?.createdAt ?? null,
        lastMessageSenderId: last?.senderId ?? null,
                lastMessageReadAt: last?.readAt ?? null,
                lastMessageType: last?.messageType ?? null,
                lastCallStatus: last?.messageType === "CALL" ? last.body : null,
                unreadCount: 0,
      };

      if (conversation.type === "DIRECT") {
        return { ...common, otherUser: other?.user ?? null };
      }

      return {
        ...common,
        name: conversation.name,
        avatarUrl: conversation.avatarUrl,
        description: conversation.description,
        createdBy: conversation.createdBy,
        members: conversation.members.map(formatMember),
      };
    });

    // unread counts for groups
    await Promise.all(
      conversations
        .filter((conversation) => conversation.type === "GROUP")
        .map(async (conversation) => {
          const mine = conversation.members.find((m) => m.userId === userId);
          const unreadAfter = new Date(
            Math.max(mine.lastReadAt.getTime(), mine.clearedAt?.getTime() || 0)
          );

          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conversation.id,
              senderId: { not: userId },
              createdAt: { gt: unreadAfter },
              deletedForEveryone: false,
              NOT: { deletedFor: { has: userId } },
            },
          });

          const item = result.find((entry) => entry.conversationId === conversation.id);
          if (item) item.unreadCount = unreadCount;
        })
    );

    res.json(result);
  } catch (error) {
    console.error("Get conversations error:", error);

    const isDbUnavailable =
      error?.code === "ECONNREFUSED" ||
      error?.code === "ETIMEDOUT" ||
      /DATABASE_URL|password|connect/i.test(error?.message || "");

    return res.status(isDbUnavailable ? 503 : 500).json({
      error: isDbUnavailable
        ? "Database unavailable. Check PostgreSQL and the backend DATABASE_URL."
        : "Failed to get conversations",
    });
  }
}

// ==========================================
// GET /api/conversations/search?q=...
// ==========================================
async function searchUsers(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 3) return res.json([]);

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        OR: [
          { email: { equals: q, mode: "insensitive" } },
          { name: { equals: q, mode: "insensitive" } },
        ],
      },
      select: userSelect,
      take: 10,
    });

    res.json(users);
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
}

// ==========================================
// POST /api/conversations   body: { "userId": 26 }
// Start or restore a direct conversation
// ==========================================
async function startConversation(req, res) {
  try {
    const me = req.user.id;
    const them = Number(req.body.userId);

    if (!Number.isInteger(them)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }
    if (me === them) {
      return res.status(400).json({ error: "Cannot chat with yourself" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: them },
      select: { id: true },
    });
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    const existing = await prisma.conversation.findFirst({
      where: {
        type: "DIRECT",
        AND: [
          { members: { some: { userId: me } } },
          { members: { some: { userId: them } } },
        ],
      },
    });

    if (existing) {
      await prisma.conversationMember.updateMany({
        where: { conversationId: existing.id, userId: me },
        data: { hidden: false },
      });

      return res.json({
        conversationId: existing.id,
        message: "Conversation already exists",
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: "DIRECT",
        members: {
          create: [
            { userId: me, role: "MEMBER" },
            { userId: them, role: "MEMBER" },
          ],
        },
      },
    });

    return res.status(201).json({
      conversationId: conversation.id,
      message: "Conversation created successfully",
    });
  } catch (error) {
    console.error("Start conversation error:", error);
    return res.status(500).json({ error: "Failed to start conversation" });
  }
}

// ==========================================
// POST /api/conversations/group
// body: { "name": "Talkora Friends", "memberIds": [23, 24], "avatarUrl": "..." }
// The logged-in user automatically becomes ADMIN.
// ==========================================
async function createGroup(req, res) {
  try {
    const creatorId = req.user.id;
    const name = (req.body.name || "").trim();
    const { avatarUrl } = req.body;

    if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== "string") {
      return res.status(400).json({ error: "Group photo URL must be a string" });
    }
    if (!name) return res.status(400).json({ error: "Group name is required" });
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        error: "Group name must be between 2 and 100 characters",
      });
    }

    const requested = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(Number) : [];
    if (requested.length === 0) {
      return res.status(400).json({ error: "At least one member is required" });
    }

    // remove duplicates and the creator
    const memberIds = [...new Set(requested)].filter((id) => id !== creatorId);
    if (memberIds.length === 0) {
      return res.status(400).json({ error: "At least one other member is required" });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    if (users.length !== memberIds.length) {
      return res.status(400).json({ error: "One or more users were not found" });
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: "GROUP",
        name,
        avatarUrl: avatarUrl || null,
        createdBy: creatorId,
        members: {
          create: [
            { userId: creatorId, role: "ADMIN" },
            ...memberIds.map((userId) => ({ userId, role: "MEMBER" })),
          ],
        },
      },
      include: { members: { include: { user: { select: userSelect } } } },
    });

    return res.status(201).json({
      message: "Group created successfully",
      group: {
        conversationId: conversation.id,
        type: conversation.type,
        name: conversation.name,
        avatarUrl: conversation.avatarUrl,
        description: conversation.description,
        createdBy: conversation.createdBy,
        createdAt: conversation.createdAt,
        members: conversation.members.map(formatMember),
      },
    });
  } catch (error) {
    console.error("Create group error:", error);
    return res.status(500).json({ error: "Failed to create group" });
  }
}

module.exports = {
  getConversations,
  searchUsers,
  startConversation,
  createGroup,
};