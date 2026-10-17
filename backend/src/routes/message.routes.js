const express = require("express");
const authenticate = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload");
const {
  sendMessage,
  sendFileMessage,
  sendCloudinaryFile,
  getMessages,
} = require("../controllers/message.controller");

const router = express.Router();

router.post("/", authenticate, sendMessage);
router.post("/upload", authenticate, upload.single("file"), sendFileMessage);
router.post("/cloudinary-file", authenticate, sendCloudinaryFile);
router.get("/:userId", authenticate, getMessages);

module.exports = router;