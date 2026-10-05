const prisma = require("../prisma"); // ADJUST: path to the file where you create your PrismaClient

/**
 * Create a notification and push it live if the user is online.
 * If the user is offline, nobody is in their room, so the emit does nothing,
 * but the saved row is sent to them when they connect next.
 *
 * Usage:
 *   await notify(io, userId, {
 *     type: "contact_added",
 *     title: "New contact",
 *     body: "Ali added you as a contact",
 *     data: { fromUserId: 5 },
 *   });
 */
async function notify(io, userId, { type, title, body = null, data = null }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data },
  });

  io.to(`user:${userId}`).emit("notification:new", notification);

  return notification;
}

module.exports = { notify };