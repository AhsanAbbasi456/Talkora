const express = require("express");

const authenticate = require("../middleware/auth.middleware");

const {
  sendMessage,
  getMessages,
} = require("../controllers/message.controller");

const router = express.Router();

// ==========================================
// SEND MESSAGE
// POST /api/messages
// ==========================================
router.post("/", authenticate, sendMessage);

// ==========================================
// GET MESSAGES
// GET /api/messages/:userId
// ==========================================
router.get("/:userId", authenticate, getMessages);

module.exports = router;