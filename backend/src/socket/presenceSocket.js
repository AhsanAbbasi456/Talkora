const prisma = require("../config/prisma");
const { deliverPendingCalls } = require("./call.socket");

// userId -> number of open sockets (tabs/devices)
const connections = new Map();

// ==========================================
// SEND MISSED MESSAGE NOTIFICATIONS
// One notification per sender: latest message + unread count.
// Uses readAt (not lastSeen), so it still works after a page
// reload or server restart, and it respects cleared chats.
// ==========================================
const emitOfflineMessageNotifications = async (io, userId) => {
  try {
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: {
        conversationId: true,
        clearedAt: true,
        lastReadAt: true,
        conversation: {
          select: {
            type: true,
            name: true,
          },
        },
      },
    });

    const membershipMap = new Map(
      memberships.map((membership) => [
        membership.conversationId,
        membership,
      ])
    );

    const unread = await prisma.message.findMany({
      where: {
        OR: [
          {
            receiverId: userId,
            readAt: null,
          },
          {
            receiverId: null,
            senderId: { not: userId },
            conversationId: {
              in: memberships
                .filter(
                  (membership) =>
                    membership.conversation.type === "GROUP"
                )
                .map((membership) => membership.conversationId),
            },
          },
        ],
        deletedForEveryone: false,
        NOT: { deletedFor: { has: userId } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    // Direct chats are grouped by sender; group chats by conversation.
    const notifications = new Map();

    for (const message of unread) {
      const membership = membershipMap.get(
        message.conversationId
      );
      if (!membership) continue;

      const isGroup =
        membership.conversation.type === "GROUP";
      const cutoff = isGroup
        ? new Date(
            Math.max(
              membership.lastReadAt.getTime(),
              membership.clearedAt?.getTime() || 0
            )
          )
        : membership.clearedAt;

      if (cutoff && message.createdAt <= cutoff) continue;

      const key = isGroup
        ? `group:${message.conversationId}`
        : `direct:${message.senderId}`;
      const entry = notifications.get(key);

      if (entry) {
        entry.count += 1;
      } else {
        notifications.set(key, {
          latest: message,
          count: 1,
          membership,
          isGroup,
        });
      }
    }

    for (const { latest, count, membership, isGroup } of notifications.values()) {
      io.to(`user:${userId}`).emit("offlineMessageNotification", {
        id: latest.id,
        senderId: latest.senderId,
        senderName: latest.sender?.name || "New message",
        body: latest.body,
        createdAt: latest.createdAt,
        count,
        conversationId: latest.conversationId,
        conversationType: membership.conversation.type,
        ...(isGroup
          ? { conversationName: membership.conversation.name }
          : { receiverId: userId }),
      });
    }
  } catch (error) {
    console.error("Offline message notification error:", error);
  }
};

const registerPresenceSocket = (io, socket) => {
  const userId = Number(socket.userId);
  if (!Number.isInteger(userId)) return;

  // ==========================================
  // USER CAME ONLINE
  // ==========================================
  connections.set(userId, (connections.get(userId) || 0) + 1);

  prisma.user
    .update({ where: { id: userId }, data: { isOnline: true } })
    .then(() => {
      io.emit("presence", { userId, isOnline: true });
      return deliverPendingCalls(io, userId);
    })
    .then(() => {
      return emitOfflineMessageNotifications(io, userId);
    })
    .catch((err) => console.error("Presence online error:", err));

  // ==========================================
  // ASK: IS THIS USER ONLINE? (when opening a chat)
  // ==========================================
  socket.on("getPresence", async (data) => {
    try {
      const otherUserId = Number(data?.userId);

      if (!Number.isInteger(otherUserId)) return;

      const user = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: { lastSeen: true },
      });

      if (!user) return;

      socket.emit("presence", {
        userId: otherUserId,
        isOnline: connections.has(otherUserId),
        lastSeen: user.lastSeen,
      });
    } catch (error) {
      console.error("Get presence error:", error);
    }
  });

  // ==========================================
  // USER WENT OFFLINE
  // ==========================================
  socket.on("disconnect", async () => {
    try {
      const count = (connections.get(userId) || 1) - 1;

      // still has another tab or device open
      if (count > 0) {
        connections.set(userId, count);
        return;
      }

      connections.delete(userId);

      const lastSeen = new Date();

      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen },
      });

      io.emit("presence", { userId, isOnline: false, lastSeen });
    } catch (error) {
      console.error("Presence offline error:", error);
    }
  });
};

module.exports = registerPresenceSocket;