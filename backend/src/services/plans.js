const prisma = require("../config/prisma");

// The one paid plan. Prices live ONLY here on the server; the browser never sends a price.
const PLANS = {
  PLUS: {
    id: "PLUS",
    name: "Talkora Plus",
    price: 499, // PKR
    currency: "PKR",
    days: 30, // each payment adds 30 days
    features: [
      "Unlimited Talkora AI questions",
      "Summarize any chat with AI",
      "Translate messages (English ↔ Urdu)",
      "Send files up to 50 MB",
    ],
  },
};

const LIMITS = {
  FREE: { aiPerDay: 10, maxFileMB: 10 },
  PLUS: { aiPerDay: null, maxFileMB: 50 }, // null = unlimited
};

const isPlus = (user) => Boolean(user?.plusUntil && new Date(user.plusUntil) > new Date());
const limitsFor = (user) => (isPlus(user) ? LIMITS.PLUS : LIMITS.FREE);

const getPlanUser = (userId) =>
  prisma.user.findUnique({ where: { id: userId }, select: { id: true, plusUntil: true } });

// AI usage is counted per UTC day
const today = () => new Date(new Date().toISOString().slice(0, 10));

const aiUsedToday = async (userId) =>
  (await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: today() } } }))?.count || 0;

// Counts one Talkora AI question. Plus users are never limited.
// Returns { allowed, used, limit }.
const useAiQuestion = async (userId) => {
  const user = await getPlanUser(userId);
  const { aiPerDay } = limitsFor(user);
  if (aiPerDay === null) return { allowed: true, used: 0, limit: null };

  const used = await aiUsedToday(userId);
  if (used >= aiPerDay) return { allowed: false, used, limit: aiPerDay };

  await prisma.aiUsage.upsert({
    where: { userId_day: { userId, day: today() } },
    update: { count: { increment: 1 } },
    create: { userId, day: today(), count: 1 },
  });
  return { allowed: true, used: used + 1, limit: aiPerDay };
};

// What the frontend needs to show locks, limits and the billing page
const planStatus = async (userId) => {
  const user = await getPlanUser(userId);
  const plus = isPlus(user);
  return {
    plan: plus ? "PLUS" : "FREE",
    isPlus: plus,
    plusUntil: plus ? user.plusUntil : null,
    limits: limitsFor(user),
    aiUsedToday: await aiUsedToday(userId),
  };
};

module.exports = { PLANS, LIMITS, isPlus, limitsFor, getPlanUser, useAiQuestion, planStatus };
