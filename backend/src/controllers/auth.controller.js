const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// ==========================================
// JOI VALIDATION
// ==========================================
const {
  registerSchema,
  loginSchema,
} = require("../validators/auth.validators");

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ==========================================
// PASSWORD STRENGTH
// ==========================================
const checkPasswordStrength = (password) => {
  if (!password) {
    return "Weak";
  }

  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) {
    return "Weak";
  }

  if (score <= 4) {
    return "Medium";
  }

  return "Strong";
};

// ==========================================
// EMAIL CONFIG CHECK
// ==========================================
const isDevEmailConfig = () => {
  const emailUser = process.env.EMAIL_USER || "";
  const emailPass = process.env.EMAIL_PASS || "";

  return (
    !emailUser ||
    !emailPass ||
    emailUser.includes("your_email") ||
    emailPass.includes("your_gmail") ||
    emailUser.includes("example") ||
    emailPass.includes("example")
  );
};

// ==========================================
// SEND OTP EMAIL
// ==========================================
const sendOtpEmail = async (email, otp) => {
  if (isDevEmailConfig()) {
    return { devMode: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Talkora" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Talkora Verification Code",

      text: `Your Talkora verification code is ${otp}. This code expires in 5 minutes.`,

      html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 500px;
          margin: 0 auto;
          padding: 30px;
          border: 1px solid #ddd;
          border-radius: 10px;
          background-color: #ffffff;
        ">
          <h2 style="margin-bottom: 20px;">
            Talkora Email Verification
          </h2>

          <p>
            Your verification code is:
          </p>

          <h1 style="
            letter-spacing: 8px;
            font-size: 32px;
            margin: 20px 0;
          ">
            ${otp}
          </h1>

          <p>
            This code will expire in <strong>5 minutes</strong>.
          </p>

          <p style="color: #666;">
            If you did not request this code, you can safely
            ignore this email.
          </p>

          <hr style="margin: 25px 0; border: none; border-top: 1px solid #ddd;" />

          <p style="font-size: 12px; color: #888;">
            This is an automated email from Talkora.
          </p>
        </div>
      `,
    });

    return { devMode: false };
  } catch (error) {
    console.error("sendOtpEmail error:", error.message);
    throw error;
  }
};

// ==========================================
// SIGNUP - REQUEST OTP
// ==========================================
const requestOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists. Please login.",
      });
    }

    const otp = generateOtp();

    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    await prisma.otpVerification.create({
      data: {
        email: normalizedEmail,
        otpHash,
        purpose: "signup",
        expiresAt,
      },
    });

    const emailResult = await sendOtpEmail(
      normalizedEmail,
      otp
    );

    res.status(200).json({
      message: "OTP sent to your email.",
      email: normalizedEmail,
      ...(emailResult.devMode
        ? { devOtp: otp }
        : {}),
    });
  } catch (error) {
    console.error("requestOtp error:", error);

    res.status(500).json({
      message: "Failed to send OTP",
      error: error.message,
    });
  }
};

// ==========================================
// SIGNUP - VERIFY OTP
// ==========================================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otpRecord =
      await prisma.otpVerification.findFirst({
        where: {
          email: normalizedEmail,
          purpose: "signup",
          used: false,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!otpRecord) {
      return res.status(400).json({
        message: "No OTP found for this email",
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        message: "OTP has expired",
      });
    }

    const isValid = await bcrypt.compare(
      otp,
      otpRecord.otpHash
    );

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    await prisma.otpVerification.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        used: true,
      },
    });

    res.status(200).json({
      message: "OTP verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("verifyOtp error:", error);

    res.status(500).json({
      message: "OTP verification failed",
      error: error.message,
    });
  }
};

// ==========================================
// FORGOT PASSWORD - REQUEST OTP
// ==========================================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const otp = generateOtp();

    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    await prisma.otpVerification.create({
      data: {
        email: normalizedEmail,
        otpHash,
        purpose: "password_reset",
        expiresAt,
        userId: existingUser.id,
      },
    });

    const emailResult = await sendOtpEmail(
      normalizedEmail,
      otp
    );

    res.status(200).json({
      message:
        "Password reset OTP sent to your email.",
      email: normalizedEmail,
      ...(emailResult.devMode
        ? { devOtp: otp }
        : {}),
    });
  } catch (error) {
    console.error("forgotPassword error:", error);

    res.status(500).json({
      message: "Failed to send password reset OTP",
      error: error.message,
    });
  }
};

// ==========================================
// FORGOT PASSWORD - VERIFY OTP
// ==========================================
const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otpRecord =
      await prisma.otpVerification.findFirst({
        where: {
          email: normalizedEmail,
          purpose: "password_reset",
          used: false,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!otpRecord) {
      return res.status(400).json({
        message:
          "No password reset OTP found for this email",
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        message: "OTP has expired",
      });
    }

    const isValid = await bcrypt.compare(
      otp,
      otpRecord.otpHash
    );

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    res.status(200).json({
      message:
        "Password reset OTP verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("verifyResetOtp error:", error);

    res.status(500).json({
      message:
        "Password reset OTP verification failed",
      error: error.message,
    });
  }
};

// ==========================================
// FORGOT PASSWORD - RESET PASSWORD
// ==========================================
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        message:
          "Email, OTP, and new password are required",
      });
    }

    const passwordStrength =
      checkPasswordStrength(newPassword);

    if (passwordStrength !== "Strong") {
      return res.status(400).json({
        message:
          "Password must be strong. Use at least 8 characters with uppercase, lowercase, number, and special character.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const otpRecord =
      await prisma.otpVerification.findFirst({
        where: {
          email: normalizedEmail,
          purpose: "password_reset",
          used: false,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!otpRecord) {
      return res.status(400).json({
        message: "No valid password reset OTP found",
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        message: "OTP has expired",
      });
    }

    const isValid = await bcrypt.compare(
      otp,
      otpRecord.otpHash
    );

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    await prisma.otpVerification.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        used: true,
      },
    });

    res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("resetPassword error:", error);

    res.status(500).json({
      message: "Failed to reset password",
      error: error.message,
    });
  }
};

// ==========================================
// REGISTER
// ==========================================
const register = async (req, res) => {
  try {
    const { error, value } =
      registerSchema.validate(req.body, {
        abortEarly: true,
      });

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const {
      name,
      email,
      password,
      otp,
      picture,
    } = value;

    const passwordStrength =
      checkPasswordStrength(password);

    if (passwordStrength !== "Strong") {
      return res.status(400).json({
        message:
          "Password must be strong. Use at least 8 characters with uppercase, lowercase, number, and special character.",
      });
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const latestOtp =
      await prisma.otpVerification.findFirst({
        where: {
          email: normalizedEmail,
          purpose: "signup",
          used: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!latestOtp) {
      return res.status(400).json({
        message:
          "Please verify OTP before registration",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const avatarUrl = picture || null;

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        emailVerified: true,
        avatarUrl: avatarUrl,
      },
    });

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "User registered successfully",
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
  } catch (error) {
    console.error("register error:", error);

    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

// ==========================================
// LOGIN
// ==========================================
const login = async (req, res) => {
  try {
    const { error, value } =
      loginSchema.validate(req.body, {
        abortEarly: true,
      });

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const { email, password } = value;

    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid password",
      });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.status(200).json({
      message: "Login successful",
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
  } catch (error) {
    console.error("login error:", error);

    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

// ==========================================
// GOOGLE LOGIN
// ==========================================
const googleLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        message: "Google access token is required",
      });
    }

    const googleResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!googleResponse.ok) {
      return res.status(401).json({
        message: "Invalid Google access token",
      });
    }

    const googleUser = await googleResponse.json();

    const {
      email,
      name,
      picture,
      email_verified,
    } = googleUser;

    if (!email || !email_verified) {
      return res.status(401).json({
        message: "Google email could not be verified",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ==========================================
    // FIND EXISTING USER
    // ==========================================
    let user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    // ==========================================
    // CREATE USER IF NOT EXISTS
    // ==========================================
    if (!user) {
      const randomPassword =
        crypto.randomBytes(32).toString("hex");

      const hashedPassword = await bcrypt.hash(
        randomPassword,
        10
      );

      user = await prisma.user.create({
        data: {
          name: name || "Google User",
          email: normalizedEmail,
          password: hashedPassword,
          emailVerified: true,
          avatarUrl: picture || null,
        },
      });
    } else {
      if (!user.emailVerified) {
        user = await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            emailVerified: true,
            avatarUrl: picture || user.avatarUrl,
          },
        });
      }
    }

    // ==========================================
    // CREATE TALKORA JWT
    // ==========================================
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    // ==========================================
    // RESPONSE
    // ==========================================
    return res.status(200).json({
      message: "Google login successful",
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
  } catch (error) {
    console.error("googleLogin error:", error);

    return res.status(500).json({
      message: "Google login failed",
      error: error.message,
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================
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