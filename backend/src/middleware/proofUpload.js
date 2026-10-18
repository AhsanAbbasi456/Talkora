const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Payment screenshots are private: NOT inside /uploads (which is public).
// Only admins can open them, through an authenticated route.
const PROOF_DIR = path.join(process.cwd(), "private-uploads", "payment-proofs");
fs.mkdirSync(PROOF_DIR, { recursive: true });

const TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PROOF_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + TYPES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) =>
    TYPES[file.mimetype]
      ? cb(null, true)
      : cb(Object.assign(new Error("Screenshot must be a JPG, PNG or WebP image"), { status: 415 })),
});

module.exports = { proofUpload, PROOF_DIR };
