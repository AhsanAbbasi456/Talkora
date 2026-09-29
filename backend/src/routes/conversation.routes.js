const express = require("express");
const authenticate = require("../middleware/auth.middleware");
const {
  getConversations,
  searchUsers,
  startConversation,
} = require("../controllers/conversation.controller");

const router = express.Router();

router.get("/", authenticate, getConversations);
router.get("/search", authenticate, searchUsers);
router.post("/", authenticate, startConversation);

module.exports = router;