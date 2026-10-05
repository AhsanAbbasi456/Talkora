const express = require("express");
const authenticate = require("../middleware/auth.middleware");
const { sendMessage, getMessages } = require("../controllers/message.controller");

const router = express.Router();

router.post("/", authenticate, sendMessage);
router.get("/:userId", authenticate, getMessages);

module.exports = router;
