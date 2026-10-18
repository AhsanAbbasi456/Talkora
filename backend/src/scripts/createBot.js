import "dotenv/config";
import prisma from "../config/prisma.js";

const bot = await prisma.user.upsert({
  where: { email: "ai@talkora.app" },
  update: {},
  create: {
    name: "Talkora AI",
    email: "ai@talkora.app",
    password: "not-a-real-password-nobody-can-login",
    status: "APPROVED",
  },
});

console.log("Bot created. ID:", bot.id);
process.exit();