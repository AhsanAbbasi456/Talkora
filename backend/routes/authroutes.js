const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const protect = require("../middleware/authmiddleware");

const router = express.Router();

console.log("AUTH ROUTES FILE LOADED");

// ==========================================
// TEST ROUTE
// GET /api/auth/test
// ==========================================

router.get("/test", (req, res) => {
  res.json({
    message: "AUTH ROUTES ARE WORKING",
  });
});

// ==========================================
// REGISTER
// POST /api/auth/register
// ==========================================

router.post("/register", async (req, res) => {
  try {
    // TEMPORARY DEBUG
    console.log("REGISTER DATA:", req.body);

    const { name, email, password, picture } = req.body;

    // Check if all required fields are provided
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      picture: picture || null,
    });

    // Send response
    res.status(201).json({
      message: "User registered successfully",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// ==========================================
// LOGIN
// POST /api/auth/login
// ==========================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Compare password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Send response
    res.status(200).json({
      message: "Login successful",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// ==========================================
// PROTECTED ROUTE
// GET /api/auth/protected
// ==========================================

router.get("/protected", protect, (req, res) => {
  res.json({
    message: "You are authenticated!",
    userId: req.userId,
  });
});

// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;