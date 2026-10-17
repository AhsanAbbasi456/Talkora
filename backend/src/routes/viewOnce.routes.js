// routes/viewOnce.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const prisma = require("../config/prisma");
const cloudinary = require("../config/cloudinary");
const auth = require("../middleware/auth.middleware");

const router = express.Router();

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

router.get("/messages/:id/view-once", auth, async (req, res) => {
  const messageId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: "Invalid message ID" });
  }

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: { include: { members: { select: { userId: true } } } },
      },
    });

    // 1. Basic checks
    if (!message || !message.viewOnce) {
      return res.status(404).json({ error: "Not found" });
    }
    if (message.deletedForEveryone) {
      return res.status(410).json({ error: "Message was deleted" });
    }
    if (message.mediaExpired || !message.fileUrl) {
      return res.status(410).json({ error: "Already opened" });
    }

    // 2. Only members of this chat can open it
    const memberIds = message.conversation.members.map((m) => m.userId);
    if (!memberIds.includes(userId)) {
      return res.status(403).json({ error: "Not allowed" });
    }

    // 3. The sender cannot open their own view-once media (same as WhatsApp)
    if (message.senderId === userId) {
      return res.status(403).json({ error: "Sender cannot open view-once media" });
    }

    // 4. Get the file ready BEFORE recording the view,
    //    so a broken file never "uses up" the one view
    const fromCloudinary = isCloudinaryUrl(message.fileUrl);
    let stream;
    let localPath = null;

    if (fromCloudinary) {
      const upstream = await fetch(message.fileUrl); // needs Node 18+
      if (!upstream.ok || !upstream.body) {
        return res.status(502).json({ error: "File could not be loaded" });
      }
      stream = Readable.fromWeb(upstream.body);
    } else {
      // path.basename blocks tricks like "../../secret"
      localPath = path.join(
        process.cwd(),
        "uploads",
        path.basename(message.fileUrl),
      );
      if (!fs.existsSync(localPath)) {
        return res.status(410).json({ error: "File no longer available" });
      }
      stream = fs.createReadStream(localPath);
    }

    // 5. Record the view. The unique rule makes a second open fail.
    try {
      await prisma.messageView.create({ data: { messageId, userId } });
    } catch (err) {
      stream.destroy();
      if (err.code === "P2002") {
        return res.status(410).json({ error: "Already opened" });
      }
      throw err;
    }

    // 6. Has everyone (except the sender) opened it now?
    const recipientCount = memberIds.filter((id) => id !== message.senderId).length;
    const viewCount = await prisma.messageView.count({ where: { messageId } });
    const everyoneViewed = viewCount >= recipientCount;

    // 7. Send the file (never cached)
    res.setHeader("Content-Type", message.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Content-Disposition", "inline");
    stream.pipe(res);

    // 8. After the file is fully sent: tell the sender, and destroy the file if everyone opened it
    res.on("finish", async () => {
      try {
        if (everyoneViewed) {
          if (fromCloudinary) {
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
            await fs.promises.unlink(localPath);
          }

          await prisma.message.update({
            where: { id: messageId },
            data: { mediaExpired: true, fileUrl: null },
          });
        }

        // Real-time: sender sees "Opened", viewer's other tabs update too
        const io = req.app.get("io");
        const event = { messageId, viewerId: userId, expired: everyoneViewed };
        io.to(`user:${message.senderId}`).emit("viewOnceOpened", event);
        io.to(`user:${userId}`).emit("viewOnceOpened", event);
      } catch (e) {
        console.error("View-once cleanup failed:", e);
      }
    });
  } catch (err) {
    console.error("View-once error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;