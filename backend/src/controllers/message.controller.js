const prisma = require("../config/prisma");

const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, body } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: "receiverId is required" });
    }

    const parsedReceiverId = Number(receiverId);

    if (!Number.isInteger(parsedReceiverId)) {
      return res.status(400).json({ error: "receiverId must be a valid number" });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ error: "Message body is required" });
    }

    if (senderId === parsedReceiverId) {
      return res.status(400).json({ error: "You cannot send a message to yourself" });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: parsedReceiverId },
    });

    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found" });
    }

    let conversation = await prisma.conversation.findFirst({
      where: {
        members: {
          some: { userId: senderId },
        },
        AND: {
          members: {
            some: { userId: parsedReceiverId },
          },
        },
      },
      include: { members: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          members: {
            create: [
              { userId: senderId },
              { userId: parsedReceiverId },
            ],
          },
        },
        include: { members: true },
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        receiverId: parsedReceiverId,
        body: body.trim(),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    const messageData = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      body: message.body,
      createdAt: message.createdAt,
    };

    return res.status(201).json({ message: messageData });
  } catch (error) {
    console.error("REST send message error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = Number(req.params.userId || req.query.userId);

    if (!Number.isInteger(otherUserId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    if (currentUserId === otherUserId) {
      return res.status(400).json({ error: "You cannot open a conversation with yourself" });
    }

    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
    });

    if (!otherUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        members: {
          some: { userId: currentUserId },
        },
        AND: {
          members: {
            some: { userId: otherUserId },
          },
        },
      },
    });

    if (!conversation) {
      return res.json({ conversationId: null, messages: [] });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    return res.json({ conversationId: conversation.id, messages });
  } catch (error) {
    console.error("REST get messages error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { sendMessage, getMessages };
