const prisma = require("../config/prisma");

const BOT_EMAIL = "ai@talkora.app";

// The Talkora AI account. `bot.id` is filled in by ensureBot() when the server starts,
// so the AI keeps working even if the database is reset (no hard-coded ID in .env).
const bot = { id: null };

const ensureBot = async () => {
  const account = await prisma.user.upsert({
    where: { email: BOT_EMAIL },
    update: { status: "APPROVED" }, // the bot must never be locked out
    create: {
      name: "Talkora AI",
      email: BOT_EMAIL,
      password: "not-a-real-password-nobody-can-login", // not a bcrypt hash, so login always fails
      emailVerified: true,
      status: "APPROVED",
      about: "Your AI assistant. Ask me anything!",
    },
  });
  bot.id = account.id;
  return account;
};

module.exports = { bot, ensureBot, BOT_EMAIL };
