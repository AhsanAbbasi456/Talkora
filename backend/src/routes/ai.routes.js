const express = require("express");
const { getAiChat, translateMessage, summarizeChat } = require("../controllers/ai.controller");
const authenticate = require("../middleware/auth.middleware");
const requirePlus = require("../middleware/requirePlus");

const router = express.Router();

router.get("/chat", authenticate, getAiChat);
// Talkora Plus features
router.post("/translate", authenticate, requirePlus("Translate"), translateMessage);
router.post("/summary", authenticate, requirePlus("Summarize"), summarizeChat);

module.exports = router;