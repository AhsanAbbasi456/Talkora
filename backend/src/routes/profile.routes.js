const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");

const router = express.Router();

// Checks the login token (same idea as your auth middleware)
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    req.user = { id: decoded.userId };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Same "Strong" rule as your register page
const isStrongPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

// Only these values are allowed for themeMode
const ALLOWED_THEME_MODES = ["system", "light", "dark"];

// PUT /api/profile  -> update my name, about, profile picture and/or theme
router.put("/", authenticate, async (req, res) => {
  try {
    const { name, about, avatarUrl, themeMode } = req.body;
    const data = {};

    if (typeof name === "string") {
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        return res
          .status(400)
          .json({ message: "Name must be between 2 and 50 letters" });
      }
      data.name = trimmed;
    }

    if (typeof about === "string") {
      const trimmed = about.trim();
      if (trimmed.length < 1 || trimmed.length > 139) {
        return res
          .status(400)
          .json({ message: "About must be between 1 and 139 characters" });
      }
      data.about = trimmed;
    }

    if (avatarUrl === null) {
      // Remove the profile picture
      data.avatarUrl = null;
    } else if (typeof avatarUrl === "string") {
      // Only accept pictures that live on YOUR Cloudinary account
      const allowedStart = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;
      if (!avatarUrl.startsWith(allowedStart)) {
        return res.status(400).json({ message: "Invalid image link" });
      }
      data.avatarUrl = avatarUrl;
    }

    if (typeof themeMode === "string") {
      if (!ALLOWED_THEME_MODES.includes(themeMode)) {
        return res.status(400).json({
          message: `themeMode must be one of: ${ALLOWED_THEME_MODES.join(", ")}`,
        });
      }
      data.themeMode = themeMode;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        about: true,
        themeMode: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Could not update profile" });
  }
});

// PUT /api/profile/password  -> change my password
router.put("/password", authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Old password and new password are required" });
    }

    if (newPassword.length > 72) {
      return res
        .status(400)
        .json({ message: "Password is too long (maximum 72 characters)" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be strong. Use at least 8 characters with uppercase, lowercase, number, and special character.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldIsCorrect = await bcrypt.compare(oldPassword, user.password);
    if (!oldIsCorrect) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) {
      return res
        .status(400)
        .json({ message: "New password must be different from your old password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Could not update password" });
  }
});

module.exports = router;