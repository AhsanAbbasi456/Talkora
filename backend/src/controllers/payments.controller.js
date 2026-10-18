const crypto = require("crypto");
const prisma = require("../config/prisma");
const { PLANS, planStatus } = require("../services/plans");
const { getProvider, enabledProviders, jazzcash, safepay, testProvider } = require("../services/payments");
const { createOrder, fulfillOrder, failOrder, publicOrder } = require("../services/payments/orders");
const { FRONTEND_URL } = require("../services/payments/urls");
const { manualAccounts, METHODS } = require("../services/payments/manualTransfer");
const fs = require("fs");

const fail = (status, error) => {
  throw Object.assign(new Error(error), { status });
};

const handler = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message, message: error.message });
    console.error(`Payments ${label} error:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Loads an order the current user is allowed to see
const findMyOrder = async (req) => {
  const order = await prisma.paymentOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order || (order.userId !== req.user.id && req.user.role !== "ADMIN")) fail(404, "Order not found");
  return order;
};

// For orders still pending: ask the payment company directly and settle the order
const settleWithProvider = async (order, io) => {
  if (order.status !== "PENDING") return;
  try {
    if (order.provider === "JAZZCASH" && jazzcash.isEnabled()) {
      const answer = await jazzcash.inquire(order.id);
      if (answer.paid) await fulfillOrder(order.id, { raw: answer.raw, io });
    }
    if (order.provider === "SAFEPAY" && safepay.isEnabled()) {
      const answer = await safepay.confirm(order);
      if (answer.paid) await fulfillOrder(order.id, { providerRef: order.providerRef, raw: answer.raw, io });
    }
  } catch (err) {
    console.error(`Status check for ${order.id} (${order.provider}) failed:`, err.message);
  }
};

// ==========================================
// GET /api/payments/plans
// ==========================================
const getPlans = handler("plans", async (req, res) => {
  res.json({
    plans: Object.values(PLANS),
    providers: enabledProviders(),
    me: await planStatus(req.user.id),
  });
});

// ==========================================
// GET /api/payments/me   (plan + payment history)
// ==========================================
const getMyPlan = handler("me", async (req, res) => {
  const [status, orders] = await Promise.all([
    planStatus(req.user.id),
    prisma.paymentOrder.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  res.json({ ...status, orders: orders.map(publicOrder) });
});

// ==========================================
// POST /api/payments/checkout   { plan: "PLUS", provider: "JAZZCASH" | "TEST" }
// ==========================================
const checkout = handler("checkout", async (req, res) => {
  const planId = req.body?.plan || "PLUS";
  if (!PLANS[planId]) fail(400, "Unknown plan");

  const provider = getProvider(req.body?.provider);
  if (!provider) fail(400, "This payment method is not available");

  // stop accidental double clicks / abuse: max 5 open orders per hour
  const open = await prisma.paymentOrder.count({
    where: {
      userId: req.user.id,
      status: "PENDING",
      createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (open >= 5) fail(429, "Too many unfinished payments. Please wait a little and try again.");

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const order = await createOrder(user.id, planId, provider.id);

  let checkoutInfo;
  try {
    checkoutInfo = await provider.createCheckout(order, user);
  } catch (error) {
    await failOrder(order.id, error.message);
    throw error;
  }
  res.status(201).json({ order: publicOrder(order), checkout: checkoutInfo });
});

// ==========================================
// GET /api/payments/orders/:id   (the result page polls this)
// ==========================================
const getOrder = handler("get order", async (req, res) => {
  let order = await findMyOrder(req);

  // never rely only on the browser coming back: double-check pending JazzCash orders
  if (order.status === "PENDING" && Date.now() - order.createdAt.getTime() > 5000) {
    await settleWithProvider(order, req.app.get("io"));
    order = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
  }

  res.json({ order: publicOrder(order), me: await planStatus(order.userId) });
});

// ==========================================
// POST /api/payments/test/:id/complete   { outcome: "success" | "fail" | "cancel" }
// Only works while test payments are enabled (never in production).
// ==========================================
const completeTestPayment = handler("test payment", async (req, res) => {
  if (!testProvider.isEnabled()) fail(404, "Test payments are turned off");

  const order = await findMyOrder(req);
  if (order.provider !== "TEST") fail(400, "Not a test order");
  if (order.status !== "PENDING") fail(409, `This order is already ${order.status.toLowerCase()}`);

  const outcome = req.body?.outcome;
  if (outcome === "success") {
    await fulfillOrder(order.id, {
      providerRef: `TEST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      raw: { test: true },
      io: req.app.get("io"),
    });
  } else {
    await failOrder(order.id, outcome === "cancel" ? "You cancelled the payment" : "Card declined (test)");
  }

  res.json({ order: publicOrder(await prisma.paymentOrder.findUnique({ where: { id: order.id } })) });
});

// ==========================================
// POST /api/payments/jazzcash/return   (JazzCash posts the result here, form-encoded)
// No login: the request is trusted only if JazzCash's signature is valid.
// ==========================================
const jazzcashReturn = async (req, res) => {
  const result = jazzcash.readReturn(req.body || {});
  const back = (orderId) =>
    res.redirect(303, `${FRONTEND_URL()}/billing/result?order=${encodeURIComponent(orderId || "")}`);

  try {
    if (!result.valid) {
      console.warn("JazzCash return with a bad signature for order", result.orderId);
      return back(result.orderId); // order stays as it was; the result page shows its real status
    }

    const order = await prisma.paymentOrder.findUnique({ where: { id: result.orderId } });
    if (!order || order.provider !== "JAZZCASH") return back(result.orderId);

    if (result.amountPaisa !== order.amount * 100) {
      console.warn(`JazzCash amount mismatch for ${order.id}`);
      await failOrder(order.id, "Amount did not match the order", req.body);
      return back(order.id);
    }

    if (result.paid) {
      // signature is fine; still confirm with JazzCash before giving Plus
      let confirmed = false;
      try {
        confirmed = (await jazzcash.inquire(order.id)).paid;
      } catch (err) {
        console.error(`JazzCash inquiry for ${order.id} failed:`, err.message);
      }
      if (confirmed) {
        await fulfillOrder(order.id, { providerRef: result.providerRef, raw: req.body, io: req.app.get("io") });
      }
      // not confirmed yet: stays PENDING, the result page re-checks in a moment
    } else if (!result.waiting) {
      await failOrder(order.id, result.message, req.body);
    }

    back(order.id);
  } catch (err) {
    console.error("JazzCash return error:", err);
    back(result.orderId);
  }
};

// ==========================================
// GET /api/payments/orders/:id/manual   (order + where to send the money)
// ==========================================
const getManualCheckout = handler("manual checkout", async (req, res) => {
  const order = await findMyOrder(req);
  if (order.provider !== "MANUAL") fail(400, "Not a transfer order");
  res.json({ order: publicOrder(order), accounts: manualAccounts() });
});

// ==========================================
// POST /api/payments/orders/:id/manual-proof   (multipart: method, transactionId, sender, proof)
// ==========================================
const submitManualProof = async (req, res) => {
  const removeUpload = () => req.file && fs.promises.unlink(req.file.path).catch(() => {});
  try {
    const order = await findMyOrder(req);
    if (order.userId !== req.user.id) fail(403, "Not your order");
    if (order.provider !== "MANUAL") fail(400, "Not a transfer order");
    if (order.status !== "PENDING") fail(409, `This order is already ${order.status === "REVIEW" ? "being verified" : order.status.toLowerCase()}`);

    const method = String(req.body.method || "");
    if (!METHODS.includes(method) || !manualAccounts().some((a) => a.method === method)) {
      fail(400, "Choose how you sent the money");
    }

    const tid = String(req.body.transactionId || "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,40}$/.test(tid)) {
      fail(400, "Enter the transaction ID (TID) from your payment receipt (6-40 letters or numbers)");
    }
    const sender = String(req.body.sender || "").trim().slice(0, 80);
    if (!sender) fail(400, "Enter the name or number the money was sent from");
    if (!req.file) fail(400, "Attach a screenshot of the payment receipt");

    try {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: "REVIEW",
          manualMethod: method,
          manualTid: tid,
          manualSender: sender,
          proofFile: req.file.filename,
          submittedAt: new Date(),
        },
      });
    } catch (error) {
      // unique index: the same transaction can't pay for two orders
      if (error.code === "P2002") fail(409, "This transaction ID was already used for another payment");
      throw error;
    }

    req.app.get("io")?.to("admins").emit("admin:payment", { orderId: order.id });
    const updated = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
    res.json({ order: publicOrder(updated) });
  } catch (error) {
    removeUpload();
    if (error.status) return res.status(error.status).json({ error: error.message, message: error.message });
    console.error("Payments manual proof error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ==========================================
// Safepay: the user comes back here after paying (return) or giving up (cancel),
// and Safepay's servers call the webhook. Plus is only given after confirm().
// ==========================================
const loadSafepayOrder = (id) =>
  prisma.paymentOrder.findFirst({ where: { id: String(id || ""), provider: "SAFEPAY" } });

const resultPage = (res, orderId) =>
  res.redirect(303, `${FRONTEND_URL()}/billing/result?order=${encodeURIComponent(orderId || "")}`);

const safepayReturn = async (req, res) => {
  const params = { ...req.query, ...(req.body || {}) };
  const order = await loadSafepayOrder(params.order || params.order_id).catch(() => null);
  try {
    if (order?.status === "PENDING") {
      const tracker = params.tracker || params.beacon;
      // the browser's word alone is never enough: the tracker must be ours, then Safepay must confirm
      if (tracker && tracker !== order.providerRef) {
        console.warn(`Safepay return: tracker mismatch for ${order.id}`);
      } else {
        if (params.sig && !safepay.validReturnSignature(tracker, params.sig)) {
          console.warn(`Safepay return: bad signature for ${order.id}`);
        }
        const answer = await safepay.confirm(order);
        if (answer.paid) {
          await fulfillOrder(order.id, { providerRef: order.providerRef, raw: answer.raw, io: req.app.get("io") });
        }
      }
    }
  } catch (err) {
    console.error("Safepay return error:", err);
  }
  resultPage(res, order?.id || params.order);
};

const safepayCancel = async (req, res) => {
  const order = await loadSafepayOrder(req.query.order).catch(() => null);
  try {
    if (order?.status === "PENDING") {
      const answer = await safepay.confirm(order);
      if (answer.paid) await fulfillOrder(order.id, { providerRef: order.providerRef, raw: answer.raw, io: req.app.get("io") });
      else await failOrder(order.id, "You cancelled the payment");
    }
  } catch (err) {
    console.error("Safepay cancel error:", err);
  }
  resultPage(res, order?.id || req.query.order);
};

const safepayWebhook = async (req, res) => {
  if (!safepay.validWebhook(req)) {
    console.warn("Safepay webhook with a bad signature");
    return res.status(401).json({ error: "Invalid signature" });
  }
  res.json({ received: true }); // answer fast; work continues below

  try {
    // find the tracker token anywhere in the event
    const tracker = JSON.stringify(req.body.data).match(/track_[0-9a-f-]{36}/)?.[0];
    if (!tracker) return;
    const order = await prisma.paymentOrder.findFirst({ where: { provider: "SAFEPAY", providerRef: tracker } });
    if (!order || order.status !== "PENDING") return;
    const answer = await safepay.confirm(order);
    if (answer.paid) await fulfillOrder(order.id, { providerRef: tracker, raw: answer.raw, io: req.app.get("io") });
  } catch (err) {
    console.error("Safepay webhook error:", err);
  }
};

module.exports = {
  safepayReturn,
  safepayCancel,
  safepayWebhook,
  getManualCheckout,
  submitManualProof,
  getPlans,
  getMyPlan,
  checkout,
  getOrder,
  completeTestPayment,
  jazzcashReturn,
};
