const prisma = require("../config/prisma");
const { hashPassword } = require("../utils/password");

const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create user",
      error: error.message,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    res.status(200).json({
      users,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to get users",
      error: error.message,
    });
  }
};

// ==========================================
// GET CURRENT USER (for the profile drawer)
// GET /api/user/me
// ==========================================
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        about: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({
      message: "Failed to get profile",
      error: error.message,
    });
  }
};

// ==========================================
// UPDATE CURRENT USER (name and/or avatarUrl)
// PATCH /api/user/me
// Body: { name?, avatarUrl? }
// ==========================================
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, avatarUrl } = req.body;

    if (name === undefined && avatarUrl === undefined) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        about: true,
      },
    });

    res.status(200).json({ message: "Profile updated", user });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

// ==========================================
// REMOVE PROFILE PHOTO
// DELETE /api/user/me/avatar
// ==========================================
const removeAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        about: true,
      },
    });

    res.status(200).json({ message: "Photo removed", user });
  } catch (error) {
    res.status(500).json({
      message: "Failed to remove photo",
      error: error.message,
    });
  }
};

// ==========================================
// GET ONE USER BY ID (for chat details panel)
// GET /api/user/:id
// ==========================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: Number(id) }, // convert string param to number
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        about: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Get user by id error:", error);
    res.status(500).json({
      message: "Failed to get user",
      error: error.message,
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  getProfile,
  updateProfile,
  removeAvatar,
  getUserById,
};