const crypto = require("crypto");
const prisma = require("../../config/prisma");
const { PLANS, isPlus } = require("../plans");
const { sendEmail } = require("../mailer");

const DAY_MS = 24 * 60 * 60 * 1000;
const ORDER_TTL_MS = 60 * 60 * 1000; // an unpaid order expires after 1 hour

// "TK" + yyMMddHHmmss + 6 random = 20 characters (fits JazzCash's pp_TxnRefNo)
const newOrderId = () => {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(2, 14);
  const random = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `TK${stamp}${random}`;
};

// The amount always comes from PLANS on the server
const createOrder = (userId, planId, provider) => {
  const plan = PLANS[planId];
  if (!plan) throw Object.assign(new Error("Unknown plan"), { status: 400 });
  return prisma.paymentOrder.create({
    data: {
      id: newOrderId(),
      userId,
      plan: plan.id,
      days: plan.days,
      amount: plan.price,
      currency: plan.currency,
      provider,
    },
  });
};

const formatPkr = (n) => `Rs ${Number(n).toLocaleString("en-PK")}`;

const sendReceipt = (user, order, plusUntil) =>
  sendEmail({
    to: user.email,
    subject: `Talkora Plus receipt · ${order.id}`,
    text: [
      `Thanks for upgrading, ${user.name}!`,
      "",
      `Order: ${order.id}`,
      `Plan: Talkora Plus (${order.days} days)`,
      `Amount: ${formatPkr(order.amount)}`,
      `Paid with: ${{ JAZZCASH: "JazzCash", MANUAL: "Bank / wallet transfer" }[order.provider] || order.provider}`,
      `Plus active until: ${plusUntil.toUTCString()}`,
    ].join("\n"),
  }).catch((err) => console.error("Receipt email failed:", err.message));

// Marks an order PAID and adds Plus days. Safe to call more than once:
// only the first call for an order changes anything (no double credit).
const fulfillOrder = async (orderId, { providerRef = null, raw = null, io } = {}) => {
  const result = await prisma.$transaction(async (tx) => {
    // a late payment after our 1-hour expiry still counts
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: orderId, status: { in: ["PENDING", "REVIEW", "EXPIRED"] } },
      data: { status: "PAID", paidAt: new Date(), providerRef, raw, failReason: null },
    });
    if (claimed.count === 0) return null; // already paid (or failed) earlier

    const order = await tx.paymentOrder.findUnique({ where: { id: orderId } });
    const user = await tx.user.findUnique({ where: { id: order.userId } });

    // buying again while Plus is active extends it; otherwise it starts now
    const start = isPlus(user) ? new Date(user.plusUntil) : new Date();
    const plusUntil = new Date(start.getTime() + order.days * DAY_MS);

    await tx.user.update({
      where: { id: user.id },
      data: { plusUntil, plusReminderSentAt: null },
    });
    return { order, user, plusUntil };
  });

  if (!result) return { alreadyHandled: true };

  const { order, user, plusUntil } = result;
  io?.to(`user:${user.id}`).emit("planUpdated", { plan: "PLUS", plusUntil });
  io?.to("admins").emit("admin:payment", { orderId: order.id });
  if (order.provider !== "ADMIN") sendReceipt(user, order, plusUntil);

  return { order, plusUntil };
};

const failOrder = (orderId, reason, raw = null) =>
  prisma.paymentOrder.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "FAILED", failReason: String(reason || "Payment failed").slice(0, 300), raw },
  });

// Unpaid orders expire: 1 hour for online payments, 24 hours for manual transfers
const expireStaleOrders = () =>
  prisma.paymentOrder.updateMany({
    where: {
      status: "PENDING",
      OR: [
        { provider: { not: "MANUAL" }, createdAt: { lt: new Date(Date.now() - ORDER_TTL_MS) } },
        { provider: "MANUAL", createdAt: { lt: new Date(Date.now() - 24 * ORDER_TTL_MS) } },
      ],
    },
    data: { status: "EXPIRED", failReason: "Payment was not completed in time" },
  });

// What the browser may see about an order (no raw provider data)
const publicOrder = (order) => ({
  id: order.id,
  plan: order.plan,
  days: order.days,
  amount: order.amount,
  currency: order.currency,
  provider: order.provider,
  status: order.status,
  failReason: order.failReason,
  paidAt: order.paidAt,
  manualMethod: order.manualMethod,
  manualTid: order.manualTid,
  submittedAt: order.submittedAt,
  createdAt: order.createdAt,
});

module.exports = {
  DAY_MS,
  createOrder,
  fulfillOrder,
  failOrder,
  expireStaleOrders,
  publicOrder,
};
