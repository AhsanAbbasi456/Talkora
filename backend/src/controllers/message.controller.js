const prisma = require("../config/prisma");

// ==========================================
// SEND MESSAGE
// ==========================================
const sendMessage = async (req, res) => {
  try {
    // Sender comes from JWT middleware
    const senderId = req.user.id;

    const { receiverId, body } = req.body;

    // ------------------------------------------
    // Validate receiverId
    // ------------------------------------------
    if (!receiverId) {
      return res.status(400).json({
        error: "receiverId is required",
      });
    }

    const parsedReceiverId = Number(receiverId);

    if (!Number.isInteger(parsedReceiverId)) {
      return res.status(400).json({
        error: "receiverId must be a valid number",
      });
    }

    // ------------------------------------------
    // Validate message body
    // ------------------------------------------
    if (!body || !body.trim()) {
      return res.status(400).json({
        error: "Message body is required",
      });
    }

    // ------------------------------------------
    // Prevent sending message to yourself
    // ------------------------------------------
    if (senderId === parsedReceiverId) {
      return res.status(400).json({
        error: "You cannot send a message to yourself",
      });
    }

    // ------------------------------------------
    // Check receiver exists
    // ------------------------------------------
    const receiver = await prisma.user.findUnique({
      where: {
        id: parsedReceiverId,
      },
    });

    if (!receiver) {
      return res.status(404).json({
        error: "Receiver not found",
      });
    }

    // ------------------------------------------
    // Find existing conversation
    // ------------------------------------------
    let conversation = await prisma.conversation.findFirst({
      where: {
        members: {
          some: {
            userId: senderId,
          },
        },
        AND: {
          members: {
            some: {
              userId: parsedReceiverId,
            },
          },
        },
      },
      include: {
        members: true,
      },
    });

    // ------------------------------------------
    // Create conversation if it doesn't exist
    // ------------------------------------------
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          members: {
            create: [
              {
                userId: senderId,
              },
              {
                userId: parsedReceiverId,
              },
            ],
          },
        },
        include: {
          members: true,
        },
      });
    }

    // ------------------------------------------
    // Create message
    // ------------------------------------------
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        receiverId: parsedReceiverId,
        body: body.trim(),
      },
    });

    // ------------------------------------------
    // Update last message time
    // ------------------------------------------
    await prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        lastMessageAt: message.createdAt,
      },
    });

    // ------------------------------------------
    // Response
    // ------------------------------------------
    return res.status(201).json({
      message: "Message sent successfully",
      data: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        body: message.body,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// ==========================================
// GET MESSAGES BETWEEN TWO USERS
// ==========================================
const getMessages = async (req, res) => {
  try {
    // Logged-in user from JWT
    const currentUserId = req.user.id;

    // User we are chatting with
    const otherUserId = Number(req.params.userId);

    // ------------------------------------------
    // Validate userId
    // ------------------------------------------
    if (!Number.isInteger(otherUserId)) {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }

    // ------------------------------------------
    // Prevent requesting your own conversation
    // ------------------------------------------
    if (currentUserId === otherUserId) {
      return res.status(400).json({
        error: "You cannot open a conversation with yourself",
      });
    }

    // ------------------------------------------
    // Check that other user exists
    // ------------------------------------------
    const otherUser = await prisma.user.findUnique({
      where: {
        id: otherUserId,
      },
    });

    if (!otherUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // ------------------------------------------
    // Find conversation between both users
    // ------------------------------------------
    const conversation = await prisma.conversation.findFirst({
      where: {
        members: {
          some: {
            userId: currentUserId,
          },
        },
        AND: {
          members: {
            some: {
              userId: otherUserId,
            },
          },
        },
      },
    });

    // ------------------------------------------
    // No conversation yet
    // ------------------------------------------
    if (!conversation) {
      return res.status(200).json({
        conversationId: null,
        messages: [],
      });
    }

    // ------------------------------------------
    // Get messages
    // ------------------------------------------
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // ------------------------------------------
    // Response
    // ------------------------------------------
    return res.status(200).json({
      conversationId: conversation.id,
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  sendMessage,
  getMessages,
};