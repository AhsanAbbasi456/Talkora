const express = require("express");
const { getAiChat, translateMessage, summarizeChat } = require("../controllers/ai.controller");
const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/chat", authenticate, getAiChat);
router.post("/translate", authenticate, translateMessage);
router.post("/summary", authenticate, summarizeChat);

module.exports = router;