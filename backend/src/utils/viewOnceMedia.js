const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");
const cloudinary = require("../config/cloudinary");

// Unopened view-once media is deleted after this long (same as WhatsApp)
const VIEW_ONCE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // check every hour

const isCloudinaryUrl = (url) => /^https?:\/\//i.test(url);

// Turns a Cloudinary URL into its publicId (needed to delete the file)
// .../image/upload/v123456/folder/name.jpg  ->  folder/name
const getCloudinaryPublicId = (url) => {
  const afterUpload = new URL(url).pathname.split("/upload/")[1];
  if (!afterUpload) return null;
  const parts = afterUpload.split("/");
  if (/^v\d+$/.test(parts[0])) parts.shift(); // remove the version part
  return decodeURIComponent(parts.join("/")).replace(/\.[^/.]+$/, "");
};

// path.basename blocks tricks like "../../secret"
const getLocalPath = (fileUrl) =>
  path.join(process.cwd(), "uploads", path.basename(fileUrl));

// Deletes the file of a view-once message and marks it as expired
const destroyViewOnceMedia = async (message) => {
  if (message.fileUrl) {
    if (isCloudinaryUrl(message.fileUrl)) {
      const publicId = getCloudinaryPublicId(message.fileUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, {
          resource_type:
            message.messageType === "VIDEO"
              ? "video"
              : message.messageType === "AUDIO"
                ? "raw"
                : "image",
        });
      }
    } else {
      await fs.promises.unlink(getLocalPath(message.fileUrl)).catch((err) => {
        if (err.code !== "ENOENT") throw err; // already gone is fine
      });
    }
  }

  await prisma.message.update({
    where: { id: message.id },
    data: { mediaExpired: true, fileUrl: null },
  });
};

// Deletes view-once media nobody opened within 14 days
const expireOldViewOnce = async (io) => {
  const stale = await prisma.message.findMany({
    where: {
      viewOnce: true,
      mediaExpired: false,
      createdAt: { lt: new Date(Date.now() - VIEW_ONCE_TTL_MS) },
    },
    include: { conversation: { include: { members: { select: { userId: true } } } } },
  });

  for (const message of stale) {
    try {
      await destroyViewOnceMedia(message);
      const event = { messageId: message.id, viewerId: null, expired: true };
      message.conversation.members.forEach(({ userId }) =>
        io.to(`user:${userId}`).emit("viewOnceOpened", event),
      );
    } catch (err) {
      console.error(`View-once expiry failed for message ${message.id}:`, err);
    }
  }
};

const startViewOnceExpiry = (io) => {
  const run = () =>
    expireOldViewOnce(io).catch((err) => console.error("View-once expiry error:", err));
  run();
  return setInterval(run, CLEANUP_INTERVAL_MS);
};

module.exports = {
  isCloudinaryUrl,
  getLocalPath,
  destroyViewOnceMedia,
  startViewOnceExpiry,
};
