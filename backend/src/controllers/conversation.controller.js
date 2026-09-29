const prisma = require("../config/prisma");

// GET /api/conversations
async function getConversations(req, res) {
  const userId = req.user.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      members: { some: { userId } },
    },
    include: {
      members: {
        where: { userId: { not: userId } },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, about: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const result = conversations.map((c) => ({
    conversationId: c.id,
    otherUser: c.members[0]?.user,
    lastMessage: c.messages[0]?.body ?? null,
    lastMessageAt: c.messages[0]?.createdAt ?? null,
  }));

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

  if (existing) return res.json({ conversationId: existing.id });

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