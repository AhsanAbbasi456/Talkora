const prisma = require("../config/prisma");

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
      select: { conversationId: true, clearedAt: true },
    });

    const clearedMap = new Map(
      memberships.map((m) => [m.conversationId, m.clearedAt])
    );

    const unread = await prisma.message.findMany({
      where: {
        receiverId: userId,
        readAt: null,
        deletedForEveryone: false,
        NOT: { deletedFor: { has: userId } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    // group by sender: latest message + count
    const bySender = new Map();

    for (const message of unread) {
      const clearedAt = clearedMap.get(message.conversationId);

      if (clearedAt && message.createdAt <= clearedAt) continue;

      const entry = bySender.get(message.senderId);

      if (entry) {
        entry.count += 1;
      } else {
        bySender.set(message.senderId, { latest: message, count: 1 });
      }
    }

    for (const { latest, count } of bySender.values()) {
      io.to(`user:${userId}`).emit("offlineMessageNotification", {
        id: latest.id,
        senderId: latest.senderId,
        receiverId: userId,
        senderName: latest.sender?.name || "New message",
        body: latest.body,
        createdAt: latest.createdAt,
        count,
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