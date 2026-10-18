const express = require("express");

const {
  requestOtp,
  verifyOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  register,
  login,
  googleLogin,
  requestStatus,
} = require("../controllers/auth.controller");

const router = express.Router();

// ================================
// Signup OTP
// ================================

router.post("/request-otp", requestOtp);

router.post("/verify-otp", verifyOtp);

// ================================
// Forgot Password
// ================================

router.post("/forgot-password", forgotPassword);

router.post("/verify-reset-otp", verifyResetOtp);

router.post("/reset-password", resetPassword);

// ================================
// Register & Login
// ================================

router.post("/register", register);

router.post("/login", login);

// ================================
// Google Login
// ================================

router.post("/google", googleLogin);

// ================================
// Track a sign-up request (pending / approved / ...)
// ================================

router.get("/request-status", requestStatus);

module.exports = router;