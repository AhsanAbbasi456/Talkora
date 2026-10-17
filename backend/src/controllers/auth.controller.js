const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { registerSchema, loginSchema } = require("../validators/auth.validators");

// ---------- helpers ----------

const WEAK_PASSWORD_MESSAGE =
  "Password must be strong. Use at least 8 characters with uppercase, lowercase, number, and special character.";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => {
  throw new HttpError(status, message);
};

// one try/catch for every endpoint
const handler = (name, failMessage, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error(`${name} error:`, error);
    res.status(500).json({ message: failMessage, error: error.message });
  }
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const isStrongPassword = (p) =>
  Boolean(p) &&
  p.length >= 8 &&
  /[A-Z]/.test(p) &&
  /[a-z]/.test(p) &&
  /[0-9]/.test(p) &&
  /[^A-Za-z0-9]/.test(p);

const requireStrongPassword = (password) => {
  if (!isStrongPassword(password)) fail(400, WEAK_PASSWORD_MESSAGE);
};

const validate = (schema, body) => {
  const { error, value } = schema.validate(body, { abortEarly: true });
  if (error) fail(400, error.details[0].message);
  return value;
};

const findUserByEmail = (email) =>
  prisma.user.findUnique({ where: { email } });

// JWT + the user object the frontend expects
const sendSession = (res, user, message, status = 200) => {
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.status(status).json({
    message,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      about: user.about,
      themeMode: user.themeMode,
    },
  });
};

// ---------- OTP ----------

const isDevEmailConfig = () => {
  const user = process.env.EMAIL_USER || "";
  const pass = process.env.EMAIL_PASS || "";

  return (
    !user ||
    !pass ||
    user.includes("your_email") ||
    pass.includes("your_gmail") ||
    user.includes("example") ||
    pass.includes("example")
  );
};

const sendOtpEmail = async (email, otp) => {
  if (isDevEmailConfig()) return { devMode: true };

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.verify();

  await transporter.sendMail({
    from: `"Talkora" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Talkora Verification Code",
    text: `Your Talkora verification code is ${otp}. This code expires in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #ffffff;">
        <h2 style="margin-bottom: 20px;">Talkora Email Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing: 8px; font-size: 32px; margin: 20px 0;">${otp}</h1>
        <p>This code will expire in <strong>5 minutes</strong>.</p>
        <p style="color: #666;">If you did not request this code, you can safely ignore this email.</p>
        <hr style="margin: 25px 0; border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #888;">This is an automated email from Talkora.</p>
      </div>
    `,
  });

  return { devMode: false };
};

// create + store + email an OTP; returns { devOtp } only in dev mode
const issueOtp = async (email, purpose, userId) => {
  const otp = generateOtp();

  await prisma.otpVerification.create({
    data: {
      email,
      otpHash: await bcrypt.hash(otp, 10),
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      ...(userId ? { userId } : {}),
    },
  });

  const { devMode } = await sendOtpEmail(email, otp);

  return devMode ? { devOtp: otp } : {};
};

// latest unused OTP must exist, be unexpired and match
const checkOtp = async (email, otp, purpose, missingMessage) => {
  const record = await prisma.otpVerification.findFirst({
    where: { email, purpose, used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!record) fail(400, missingMessage);
  if (new Date() > record.expiresAt) fail(400, "OTP has expired");
  if (!(await bcrypt.compare(otp, record.otpHash))) fail(400, "Invalid OTP");

  return record;
};

const markOtpUsed = (id) =>
  prisma.otpVerification.update({ where: { id }, data: { used: true } });

// ---------- signup OTP ----------

const requestOtp = handler("requestOtp", "Failed to send OTP", async (req, res) => {
  const { email } = req.body;
  if (!email) fail(400, "Email is required");

  const normalized = normalizeEmail(email);

  if (await findUserByEmail(normalized)) {
    fail(409, "User already exists. Please login.");
  }

  const extra = await issueOtp(normalized, "signup");

  res.status(200).json({
    message: "OTP sent to your email.",
    email: normalized,
    ...extra,
  });
});

const verifyOtp = handler("verifyOtp", "OTP verification failed", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) fail(400, "Email and OTP are required");

  const record = await checkOtp(
    normalizeEmail(email),
    otp,
    "signup",
    "No OTP found for this email"
  );

  await markOtpUsed(record.id);

  res.status(200).json({ message: "OTP verified successfully", verified: true });
});

// ---------- forgot password ----------

const forgotPassword = handler(
  "forgotPassword",
  "Failed to send password reset OTP",
  async (req, res) => {
    const { email } = req.body;
    if (!email) fail(400, "Email is required");

    const normalized = normalizeEmail(email);
    const user = await findUserByEmail(normalized);
    if (!user) fail(404, "User not found");

    const extra = await issueOtp(normalized, "password_reset", user.id);

    res.status(200).json({
      message: "Password reset OTP sent to your email.",
      email: normalized,
      ...extra,
    });
  }
);

const verifyResetOtp = handler(
  "verifyResetOtp",
  "Password reset OTP verification failed",
  async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) fail(400, "Email and OTP are required");

    await checkOtp(
      normalizeEmail(email),
      otp,
      "password_reset",
      "No password reset OTP found for this email"
    );

    res.status(200).json({
      message: "Password reset OTP verified successfully",
      verified: true,
    });
  }
);

const resetPassword = handler("resetPassword", "Failed to reset password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    fail(400, "Email, OTP, and new password are required");
  }

  requireStrongPassword(newPassword);

  const normalized = normalizeEmail(email);
  const user = await findUserByEmail(normalized);
  if (!user) fail(404, "User not found");

  const record = await checkOtp(
    normalized,
    otp,
    "password_reset",
    "No valid password reset OTP found"
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });

  await markOtpUsed(record.id);

  res.status(200).json({ message: "Password reset successfully" });
});

// ---------- register / login ----------

const register = handler("register", "Registration failed", async (req, res) => {
  const { name, email, password, picture } = validate(registerSchema, req.body);

  requireStrongPassword(password);

  const normalized = normalizeEmail(email);

  if (await findUserByEmail(normalized)) fail(409, "User already exists");

  // the signup OTP must have been verified (marked used) first
  const verifiedOtp = await prisma.otpVerification.findFirst({
    where: { email: normalized, purpose: "signup", used: true },
    orderBy: { createdAt: "desc" },
  });

  if (!verifiedOtp) fail(400, "Please verify OTP before registration");

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalized,
      password: await bcrypt.hash(password, 10),
      emailVerified: true,
      avatarUrl: picture || null,
    },
  });

  sendSession(res, user, "User registered successfully", 201);
});

const login = handler("login", "Login failed", async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);

  const user = await findUserByEmail(normalizeEmail(email));
  if (!user) fail(404, "User not found");

  if (!(await bcrypt.compare(password, user.password))) {
    fail(401, "Invalid password");
  }

  sendSession(res, user, "Login successful");
});

// ---------- Google login ----------

const googleLogin = handler("googleLogin", "Google login failed", async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) fail(400, "Google access token is required");

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) fail(401, "Invalid Google access token");

  const { email, name, picture, email_verified } = await response.json();

  if (!email || !email_verified) fail(401, "Google email could not be verified");

  const normalized = normalizeEmail(email);
  let user = await findUserByEmail(normalized);

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: name || "Google User",
        email: normalized,
        password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
        emailVerified: true,
        avatarUrl: picture || null,
      },
    });
  } else if (!user.emailVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, avatarUrl: picture || user.avatarUrl },
    });
  }

  sendSession(res, user, "Google login successful");
});

module.exports = {
  requestOtp,
  verifyOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  register,
  login,
  googleLogin,
};