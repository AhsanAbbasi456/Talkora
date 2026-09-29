const express = require("express");

const {
  createUser,
  getUsers,
  getProfile,
  updateProfile,
  removeAvatar,
  getUserById,
} = require("../controllers/user.controller");

const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

// Users
router.post("/", createUser);
router.get("/", getUsers);

// Authenticated user's profile
router.get("/profile", authenticate, getProfile);
router.patch("/profile", authenticate, updateProfile);

// Profile avatar
router.delete("/profile/avatar", authenticate, removeAvatar);

// Get one user by id (must stay AFTER the /profile routes above)
router.get("/:id", authenticate, getUserById);

module.exports = router;