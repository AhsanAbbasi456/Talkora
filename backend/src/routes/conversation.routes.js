const express = require("express");

const authenticate = require("../middleware/auth.middleware");

const {
  getConversations,
  searchUsers,
  startConversation,
  createGroup,
} = require("../controllers/conversation.controller");

const group = require("../controllers/group.controller");

const router = express.Router();

router.get("/", authenticate, getConversations);
router.get("/search", authenticate, searchUsers);
router.post("/", authenticate, startConversation);

// Groups
router.post("/group", authenticate, createGroup);
router.get("/group/:id", authenticate, group.getGroupInfo);
router.patch("/group/:id", authenticate, group.updateGroup);
router.post("/group/:id/members", authenticate, group.addMembers);
router.patch("/group/:id/members/:userId", authenticate, group.setRole);
router.delete("/group/:id/members/:userId", authenticate, group.removeMember);
router.post("/group/:id/leave", authenticate, group.leaveGroup);

module.exports = router;