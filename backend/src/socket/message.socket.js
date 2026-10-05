const prisma = require("../config/prisma");

const emitSocketError = (socket, message) => {
  socket.emit("messageError", { error: message });
};

const isValidInteger = (value) => Number.isInteger(Number(value));

// ==========================================
// NEW: UNREAD SUMMARY (messages missed while offline)
// One entry per sender, respecting clearedAt and deletions
// ==========================================

const getUnreadSummary = async (userId) => {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true, clearedAt: true },
  });

  const summary = [];

  for (const membership of memberships) {
    const where = {
      conversationId: membership.conversationId,
      receiverId: userId,
      readAt: null,
      deletedForEveryone: false,
      NOT: { deletedFor: { has: userId } },
      ...(membership.clearedAt
        ? { createdAt: { gt: membership.clearedAt } }
        : {}),
    };

    const count = await prisma.message.count({ where });

    if (!count) continue;

    const last = await prisma.message.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        body: true,
        createdAt: true,
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    summary.push({
      conversationId: membership.conversationId,
      senderId: last.sender.id,
      sender: last.sender,
      count,
      lastBody: last.body,
      lastAt: last.createdAt,
    });
  }

  return summary;
};

// ==========================================
// NEW: live notification to the receiver
// If the receiver is offline nobody is in the room,
// so this does nothing and the message is picked up
// by getUnreadSummary when they come back online.
// ==========================================

const emitMessageNotification = async (io, message) => {
  try {
    const sender = await prisma.user.findUnique({
      where: { id: message.senderId },
      select: { id: true, name: true, avatarUrl: true },
    });

    io.to(`user:${message.receiverId}`).emit("notification:message", {
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender,
      body: message.body,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error("Notification emit error:", error);
  }
};

const registerMessageSocket = (io, socket) => {
  // ==========================================
  // NEW: SEND PENDING NOTIFICATIONS ON REQUEST
  // The frontend emits "notifications:request" right after
  // it has attached its listeners (on connect/reconnect).
  // ==========================================

  socket.on("notifications:request", async () => {
    try {
      const userId = Number(socket.userId);

      const [messages, others] = await Promise.all([
        getUnreadSummary(userId),
        prisma.notification.findMany({
          where: { userId, readAt: null },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);

      socket.emit("notifications:pending", { messages, others });
    } catch (error) {
      console.error("Socket pending notifications error:", error);

      emitSocketError(socket, "Internal server error");
    }
  });

  // ==========================================
  // NEW: MARK GENERAL NOTIFICATIONS AS READ
  // ==========================================

  socket.on("notifications:markRead", async (ids) => {
    try {
      const userId = Number(socket.userId);

      const idList = Array.isArray(ids)
        ? ids.map(Number).filter(Number.isInteger)
        : [];

      if (!idList.length) return;

      await prisma.notification.updateMany({
        where: {
          userId,
          id: { in: idList },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    } catch (error) {
      console.error("Socket notifications markRead error:", error);

      emitSocketError(socket, "Internal server error");
    }
  });

  // ==========================================
  // TYPING INDICATOR
  // ==========================================

  socket.on("typing", (data) => {
    const receiverId = Number(data?.receiverId);

    if (!Number.isInteger(receiverId)) return;

    io.to(`user:${receiverId}`).emit("typing", {
      userId: Number(socket.userId),
      isTyping: Boolean(data?.isTyping),
    });
  });

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  socket.on("sendMessage", async (data) => {
    try {
      const senderId = socket.userId;

      const { receiverId, body } = data;

      // ------------------------------------------
      // Validate receiverId
      // ------------------------------------------

      if (!receiverId) {
        emitSocketError(socket, "receiverId is required");
        return;
      }

      const parsedReceiverId = Number(receiverId);

      if (!isValidInteger(parsedReceiverId)) {
        emitSocketError(socket, "receiverId must be a valid number");
        return;
      }

      // ------------------------------------------
      // Validate message body
      // ------------------------------------------

      if (!body || !body.trim()) {
        emitSocketError(socket, "Message body is required");
        return;
      }

      // ------------------------------------------
      // Prevent sending message to yourself
      // ------------------------------------------

      if (senderId === parsedReceiverId) {
        emitSocketError(socket, "You cannot send a message to yourself");
        return;
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
        emitSocketError(socket, "Receiver not found");
        return;
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
      // A new message brings the chat back
      // for anyone who had deleted it
      // ------------------------------------------

      await prisma.conversationMember.updateMany({
        where: {
          conversationId: conversation.id,
          hidden: true,
        },
        data: {
          hidden: false,
        },
      });

      // ------------------------------------------
      // Message data
      // ------------------------------------------

      const messageData = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        body: message.body,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        replyToId: message.replyToId,
        replyToText: null,
      };

      // ------------------------------------------
      // Send message back to sender
      // ------------------------------------------

      socket.emit("messageSent", messageData);

      // ------------------------------------------
      // Send message to receiver
      // ------------------------------------------

      io.to(`user:${parsedReceiverId}`).emit(
        "newMessage",
        messageData
      );

      // ------------------------------------------
      // NEW: notification for the receiver
      // ------------------------------------------

      await emitMessageNotification(io, message);
    } catch (error) {
      console.error("Socket send message error:", error);

      emitSocketError(socket, "Internal server error");
    }
  });

  // ==========================================
  // GET MESSAGES
  // ==========================================

  socket.on("getMessages", async (data) => {
    try {
      const currentUserId = socket.userId;

      const { userId } = data;

      const otherUserId = Number(userId);

      // ------------------------------------------
      // Validate userId
      // ------------------------------------------

      if (!isValidInteger(otherUserId)) {
        emitSocketError(socket, "Invalid user ID");
        return;
      }

      // ------------------------------------------
      // Prevent requesting your own conversation
      // ------------------------------------------

      if (currentUserId === otherUserId) {
        emitSocketError(socket, "You cannot open a conversation with yourself");
        return;
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
        emitSocketError(socket, "User not found");
        return;
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
        include: {
          members: true,
        },
      });

      // ------------------------------------------
      // No conversation yet
      // ------------------------------------------

      if (!conversation) {
        socket.emit("messages", {
          conversationId: null,
          messages: [],
        });

        return;
      }

      // ------------------------------------------
      // When did I last clear/delete this chat?
      // ------------------------------------------

      const myMembership = conversation.members.find(
        (member) => member.userId === currentUserId
      );

      const clearedAt = myMembership?.clearedAt;

      // ------------------------------------------
      // Get messages
      // ------------------------------------------

      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversation.id,

          // only messages after I cleared the chat
          ...(clearedAt
            ? { createdAt: { gt: clearedAt } }
            : {}),

          // hide messages this user deleted "for me"
          NOT: {
            deletedFor: {
              has: currentUserId,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // ------------------------------------------
      // Mask the text of messages deleted for
      // everyone. The database is NOT changed,
      // only the copy sent to the browser.
      // ------------------------------------------

      const safeMessages = messages.map((message) =>
        message.deletedForEveryone
          ? { ...message, body: "" }
          : message
      );

      // ------------------------------------------
      // Send messages back through Socket.IO
      // ------------------------------------------

      socket.emit("messages", {
        conversationId: conversation.id,
        messages: safeMessages,
      });
    } catch (error) {
      console.error("Socket get messages error:", error);

      emitSocketError(socket, "Internal server error");
    }
  });

  // ==========================================
  // MARK MESSAGES AS READ
  // ==========================================

  socket.on("markRead", async (data) => {
    try {
      const currentUserId = Number(socket.userId);
      const senderId = Number(data?.senderId);

      if (!isValidInteger(senderId)) {
        emitSocketError(socket, "Invalid sender ID");
        return;
      }

      if (currentUserId === senderId) {
        return;
      }

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
                userId: senderId,
              },
            },
          },
        },
      });

      if (!conversation) {
        return;
      }

      const readAt = new Date();

      const updated = await prisma.message.updateMany({
        where: {
          conversationId: conversation.id,
          senderId,
          receiverId: currentUserId,
          readAt: null,
          deletedForEveryone: false,
        },
        data: {
          readAt,
        },
      });

      if (updated.count > 0) {
        const payload = {
          readerId: currentUserId,
          readAt: readAt.toISOString(),
        };

        io.to(`user:${senderId}`).emit(
          "messagesRead",
          payload
        );
      }
    } catch (error) {
      console.error("Socket mark read error:", error);

      emitSocketError(socket, "Internal server error");
    }
  });

  // ==========================================
  // REPLY TO MESSAGE
  // ==========================================

  socket.on("replyMessage", async (data) => {
    try {
      const senderId = socket.userId;
      const receiverId = Number(data?.receiverId);
      const replyToId = Number(data?.replyToId);
      const body =
        typeof data?.body === "string"
          ? data.body.trim()
          : "";

      if (!isValidInteger(receiverId)) {
        emitSocketError(socket, "Invalid receiver ID");
        return;
      }

      if (!body) {
        emitSocketError(socket, "Message body is required");
        return;
      }

      if (senderId === receiverId) {
        emitSocketError(socket, "You cannot reply to yourself");
        return;
      }

      if (!isValidInteger(replyToId)) {
        emitSocketError(socket, "Invalid reply target");
        return;
      }

      const replyTarget = await prisma.message.findUnique({
        where: {
          id: replyToId,
        },
      });

      if (!replyTarget) {
        emitSocketError(socket, "Message not found");
        return;
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          members: {
            some: {
              userId: senderId,
            },
          },
          AND: {
            members: {
              some: {
                userId: receiverId,
              },
            },
          },
        },
      });

      if (!conversation) {
        emitSocketError(socket, "Conversation not found");
        return;
      }

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          receiverId,
          body,
          replyToId: replyTarget.id,
        },
      });

      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          lastMessageAt: message.createdAt,
        },
      });

      await prisma.conversationMember.updateMany({
        where: {
          conversationId: conversation.id,
          hidden: true,
        },
        data: {
          hidden: false,
        },
      });

      const payload = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        body: message.body,
        createdAt: message.createdAt,
        editedAt: null,
        replyToId: message.replyToId,
        replyToText: replyTarget.body,
      };

      socket.emit("messageSent", payload);

      io.to(`user:${receiverId}`).emit(
        "newMessage",
        payload
      );

      // NEW: notification for the receiver
      await emitMessageNotification(io, message);
    } catch (error) {
      console.error("Socket reply message error:", error);

      emitSocketError(socket, "Internal server error");
    }
  });

  // ==========================================
  // EDIT MESSAGE
  // ==========================================

  socket.on("editMessage", async (data) => {
    try {
      const currentUserId = Number(socket.userId);
      const messageId = Number(data?.messageId);
      const body =
        typeof data?.body === "string"
          ? data.body.trim()
          : "";

      if (!isValidInteger(messageId)) {
        emitSocketError(socket, "Invalid message ID");
        return;
      }

      if (!body) {
        emitSocketError(socket, "Message body is required");
        return;
      }

      const message = await prisma.message.findUnique({
        where: {
          id: messageId,
        },
      });

      if (!message) {
        emitSocketError(socket, "Message not found");
        return;
      }

      if (message.senderId !== currentUserId) {
        emitSocketError(socket, "Not allowed");
        return;
      }

      const updated = await prisma.message.update({
        where: {
          id: messageId,
        },
        data: {
          body,
          editedAt: new Date(),
        },
      });

      const payload = {
        id: updated.id,
        messageId: updated.id,
        body: updated.body,
        editedAt: updated.editedAt,
        senderId: updated.senderId,
        receiverId: updated.receiverId,
      };

      socket.emit("messageEdited", payload);

      io.to(`user:${updated.receiverId}`).emit(
        "messageEdited",
        payload
      );
    } catch (error) {
      console.error("Socket edit message error:", error);

      emitSocketError(socket, "Internal server error");
    }
  });

  // ==========================================
  // DELETE MESSAGE
  // ==========================================

  socket.on("deleteMessage", async (data) => {
    try {
      const currentUserId = Number(socket.userId);

      const { messageId, mode } = data;

      const id = Number(messageId);

      if (!isValidInteger(id)) {
        emitSocketError(socket, "Invalid message ID");
        return;
      }

      if (mode !== "everyone" && mode !== "me") {
        emitSocketError(socket, "Invalid delete mode");
        return;
      }

      const message = await prisma.message.findUnique({
        where: {
          id,
        },
      });

      if (!message) {
        socket.emit("messageError", {
          error: "Message not found",
        });

        return;
      }

      const isParticipant =
        message.senderId === currentUserId ||
        message.receiverId === currentUserId;

      if (!isParticipant) {
        socket.emit("messageError", {
          error: "Not allowed",
        });

        return;
      }

      // ------------------------------------------
      // DELETE FOR EVERYONE
      // Only your own messages
      // ------------------------------------------

      if (mode === "everyone") {
        if (message.senderId !== currentUserId) {
          socket.emit("messageError", {
            error:
              "You can only delete your own messages for everyone",
          });

          return;
        }

        await prisma.message.update({
          where: {
            id,
          },
          data: {
            deletedForEveryone: true,
            deletedAt: new Date(),
          },
        });

        const payload = {
          messageId: id,
          mode: "everyone",
        };

        // Send delete event to sender
        socket.emit("messageDeleted", payload);

        // Send delete event to receiver
        io.to(`user:${message.receiverId}`).emit(
          "messageDeleted",
          payload
        );

        return;
      }

      // ------------------------------------------
      // DELETE FOR ME
      // ------------------------------------------

      if (!message.deletedFor.includes(currentUserId)) {
        await prisma.message.update({
          where: {
            id,
          },
          data: {
            deletedFor: {
              push: currentUserId,
            },
          },
        });
      }

      socket.emit("messageDeleted", {
        messageId: id,
        mode: "me",
      });
    } catch (error) {
      console.error(
        "Socket delete message error:",
        error
      );

      socket.emit("messageError", {
        error: "Internal server error",
      });
    }
  });

  // ==========================================
  // UNDO DELETE MESSAGE
  // ==========================================

  socket.on("undoDeleteMessage", async (data) => {
    try {
      const currentUserId = Number(socket.userId);

      const messageId = Number(data?.messageId);
      const mode = data?.mode;

      // ------------------------------------------
      // Validate message ID
      // ------------------------------------------

      if (!isValidInteger(messageId)) {
        emitSocketError(socket, "Invalid message ID");
        return;
      }

      // ------------------------------------------
      // Validate undo mode
      // ------------------------------------------

      if (mode !== "everyone" && mode !== "me") {
        emitSocketError(socket, "Invalid undo mode");
        return;
      }

      // ------------------------------------------
      // Find message
      // ------------------------------------------

      const message = await prisma.message.findUnique({
        where: {
          id: messageId,
        },
      });

      if (!message) {
        emitSocketError(socket, "Message not found");
        return;
      }

      // ------------------------------------------
      // Check user is a participant
      // ------------------------------------------

      const isParticipant =
        message.senderId === currentUserId ||
        message.receiverId === currentUserId;

      if (!isParticipant) {
        emitSocketError(socket, "Not allowed");
        return;
      }

      // ------------------------------------------
      // UNDO DELETE FOR EVERYONE
      // ------------------------------------------

      if (mode === "everyone") {
        // Only the original sender can undo
        // Delete for Everyone.
        if (message.senderId !== currentUserId) {
          emitSocketError(socket, "Only the sender can undo delete for everyone");
          return;
        }

        // Message must actually be deleted.
        if (!message.deletedForEveryone) {
          emitSocketError(socket, "Message is not deleted for everyone");
          return;
        }

        const restored = await prisma.message.update({
          where: {
            id: messageId,
          },
          data: {
            deletedForEveryone: false,
            deletedAt: null,
          },
        });

        // ------------------------------------------
        // Get reply information
        // ------------------------------------------

        let replyToText = null;

        if (restored.replyToId) {
          const replyTarget =
            await prisma.message.findUnique({
              where: {
                id: restored.replyToId,
              },
              select: {
                body: true,
              },
            });

          replyToText = replyTarget?.body ?? null;
        }

        // ------------------------------------------
        // Restored message payload
        // ------------------------------------------

        const payload = {
          id: restored.id,
          messageId: restored.id,
          conversationId: restored.conversationId,
          senderId: restored.senderId,
          receiverId: restored.receiverId,
          body: restored.body,
          createdAt: restored.createdAt,
          editedAt: restored.editedAt,
          replyToId: restored.replyToId,
          replyToText,
          mode: "everyone",
        };

        // ------------------------------------------
        // Restore for sender
        // ------------------------------------------

        socket.emit(
          "messageRestored",
          payload
        );

        // ------------------------------------------
        // Restore for receiver
        // ------------------------------------------

        io.to(`user:${restored.receiverId}`).emit(
          "messageRestored",
          payload
        );

        return;
      }

      // ------------------------------------------
      // UNDO DELETE FOR ME
      // ------------------------------------------

      if (mode === "me") {
        // Message must be deleted for this user.
        if (!message.deletedFor.includes(currentUserId)) {
          emitSocketError(socket, "Message is not deleted for you");
          return;
        }

        // ------------------------------------------
        // Remove only current user's ID
        // ------------------------------------------

        const updatedDeletedFor =
          message.deletedFor.filter(
            (userId) =>
              Number(userId) !== currentUserId
          );

        const restored =
          await prisma.message.update({
            where: {
              id: messageId,
            },
            data: {
              deletedFor: updatedDeletedFor,
            },
          });

        // ------------------------------------------
        // Get reply information
        // ------------------------------------------

        let replyToText = null;

        if (restored.replyToId) {
          const replyTarget =
            await prisma.message.findUnique({
              where: {
                id: restored.replyToId,
              },
              select: {
                body: true,
              },
            });

          replyToText = replyTarget?.body ?? null;
        }

        // ------------------------------------------
        // Restored message payload
        // ------------------------------------------

        const payload = {
          id: restored.id,
          messageId: restored.id,
          conversationId: restored.conversationId,
          senderId: restored.senderId,
          receiverId: restored.receiverId,
          body: restored.body,
          createdAt: restored.createdAt,
          editedAt: restored.editedAt,
          replyToId: restored.replyToId,
          replyToText,
          mode: "me",
        };

        // ------------------------------------------
        // Only the user who deleted the message
        // needs to receive the restoration.
        // ------------------------------------------

        socket.emit(
          "messageRestored",
          payload
        );
      }
    } catch (error) {
      console.error(
        "Socket undo delete message error:",
        error
      );

      emitSocketError(socket, "Internal server error");
    }
  });

  // ==========================================
  // DELETE OR CLEAR CHAT (for me only)
  // ==========================================

  socket.on("deleteChat", async (data) => {
    try {
      const currentUserId = Number(socket.userId);

      const { userId, mode } = data;

      const otherUserId = Number(userId);

      if (!isValidInteger(otherUserId)) {
        emitSocketError(socket, "Invalid user ID");
        return;
      }

      if (mode !== "delete" && mode !== "clear") {
        emitSocketError(socket, "Invalid mode");
        return;
      }

      // ------------------------------------------
      // Find the conversation between both users
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

      if (!conversation) {
        emitSocketError(socket, "Chat not found");
        return;
      }

      // ------------------------------------------
      // Update ONLY my own membership row.
      // No messages are deleted from the database.
      // ------------------------------------------

      await prisma.conversationMember.updateMany({
        where: {
          conversationId: conversation.id,
          userId: currentUserId,
        },
        data:
          mode === "delete"
            ? {
                clearedAt: new Date(),
                hidden: true,
              }
            : {
                clearedAt: new Date(),
              },
      });

      socket.emit("chatDeleted", {
        userId: otherUserId,
        mode,
      });
    } catch (error) {
      console.error(
        "Socket delete chat error:",
        error
      );

      emitSocketError(socket, "Internal server error");
    }
  });
};

module.exports = registerMessageSocket;