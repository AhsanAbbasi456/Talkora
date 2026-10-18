const nodemailer = require("nodemailer");

// true when EMAIL_USER / EMAIL_PASS are missing or still placeholders
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

// Sends one email. In dev mode (no real credentials) it does nothing.
const sendEmail = async ({ to, subject, text, html }) => {
  if (isDevEmailConfig()) return { devMode: true };

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: `"Talkora" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });

  return { devMode: false };
};

module.exports = { isDevEmailConfig, sendEmail };
