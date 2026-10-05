const prisma = require("../config/prisma");

// GET /api/conversations
async function getConversations(req, res) {
  const userId = req.user.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      // CHANGED: skip chats this user deleted
      members: { some: { userId, hidden: false } },
    },
    include: {
      // CHANGED: load all members (we need my own row for clearedAt)
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, about: true },
          },
        },
      },
      messages: {
        // NEW: skip messages I deleted "for me"
        where: { NOT: { deletedFor: { has: userId } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const result = conversations.map((c) => {
    // NEW: find my row and the other person's row
    const mine = c.members.find((m) => m.userId === userId);
    const other = c.members.find((m) => m.userId !== userId);

    let last = c.messages[0] ?? null;

    // NEW: ignore a last message from before I cleared the chat
    if (last && mine?.clearedAt && last.createdAt <= mine.clearedAt) {
      last = null;
    }

    return {
      conversationId: c.id,
      otherUser: other?.user,
      // NEW: show a placeholder if it was deleted for everyone
      lastMessage: last
        ? last.deletedForEveryone
          ? "This message was deleted"
          : last.body
        : null,
      lastMessageAt: last?.createdAt ?? null,
    };
  });

  res.json(result);
}

// GET /api/conversations/search?q=...
async function searchUsers(req, res) {
  const q = (req.query.q || "").trim();
  const userId = req.user.id;

  if (q.length < 3) return res.json([]);

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { email: { equals: q, mode: "insensitive" } },
        { name: { equals: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, avatarUrl: true, about: true },
    take: 10,
  });

  res.json(users);
}

// POST /api/conversations   body: { userId }
async function startConversation(req, res) {
  const me = req.user.id;
  const them = Number(req.body.userId);

  if (!them) return res.status(400).json({ error: "userId is required" });
  if (me === them) return res.status(400).json({ error: "Cannot chat with yourself" });

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { members: { some: { userId: me } } },
        { members: { some: { userId: them } } },
      ],
    },
  });

  if (existing) {
    // NEW: if I had deleted this chat, show it in my list again.
    // Old messages stay hidden because clearedAt is kept.
    await prisma.conversationMember.updateMany({
      where: { conversationId: existing.id, userId: me },
      data: { hidden: false },
    });

    return res.json({ conversationId: existing.id });
  }

  const conversation = await prisma.conversation.create({
    data: {
      members: {
        create: [{ userId: me }, { userId: them }],
      },
    },
  });

  res.json({ conversationId: conversation.id });
}

module.exports = { getConversations, searchUsers, startConversation };