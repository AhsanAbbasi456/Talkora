const crypto = require("crypto");
const prisma = require("../../config/prisma");
const { BACKEND_URL } = require("./urls");

// Safepay hosted checkout (cards). Follows Safepay's official Node SDK (@sfpy/node-sdk):
//   1. POST /order/v1/init           -> a "tracker" token for this payment
//   2. send the user to /checkout/pay?beacon=<tracker>&...
//   3. Safepay sends the user back (tracker + sig) and calls our webhook
//   4. we confirm with GET /order/v1/<tracker> before giving Plus
//
// Needs in backend/.env:
//   SAFEPAY_PUBLIC_KEY (sec_...), SAFEPAY_SECRET_KEY, SAFEPAY_WEBHOOK_SECRET
//   SAFEPAY_ENV=sandbox (default) or production

const HOSTS = {
  sandbox: { api: "https://sandbox.api.getsafepay.com", checkout: "https://sandbox.api.getsafepay.com/checkout/pay" },
  production: { api: "https://api.getsafepay.com", checkout: "https://getsafepay.com/checkout/pay" },
};

const config = () => {
  const env = process.env.SAFEPAY_ENV === "production" ? "production" : "sandbox";
  return {
    env,
    ...HOSTS[env],
    publicKey: process.env.SAFEPAY_PUBLIC_KEY,
    secretKey: process.env.SAFEPAY_SECRET_KEY,
    webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET,
  };
};

// A finished, paid tracker. Safepay marks completed payments as TRACKER_ENDED.
const PAID_STATES = ["TRACKER_ENDED"];

const safeEqual = (a = "", b = "") =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const hmac = (algorithm, key, data) => crypto.createHmac(algorithm, key).update(data).digest("hex");

const safepay = {
  id: "SAFEPAY",
  name: "Debit / credit card",
  description: "Visa, Mastercard and UnionPay, via Safepay's secure checkout",
  test: false,

  isEnabled: () => {
    const c = config();
    return Boolean(c.publicKey && c.secretKey);
  },

  // 1 + 2: create the payment at Safepay, remember its tracker, return the checkout link
  createCheckout: async (order) => {
    const c = config();
    const res = await fetch(`${c.api}/order/v1/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: order.amount, // rupees
        currency: "PKR",
        client: c.publicKey,
        environment: c.env,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    const tracker = body?.data?.token;
    if (!res.ok || !tracker) {
      console.error("Safepay init failed:", res.status, JSON.stringify(body).slice(0, 300));
      throw Object.assign(new Error("Card payments are not available right now. Please try again."), { status: 502 });
    }

    // the tracker ties Safepay's payment to OUR order
    await prisma.paymentOrder.update({ where: { id: order.id }, data: { providerRef: tracker } });

    const back = `${BACKEND_URL()}/api/payments/safepay`;
    const params = new URLSearchParams({
      beacon: tracker,
      env: c.env,
      order_id: order.id,
      source: "custom",
      webhooks: "true",
      redirect_url: `${back}/return?order=${order.id}`,
      cancel_url: `${back}/cancel?order=${order.id}`,
    });
    return { type: "redirect", url: `${c.checkout}?${params}` };
  },

  // The "sig" Safepay sends back: HMAC-SHA256 of the tracker with our secret key
  validReturnSignature: (tracker, sig) => {
    const c = config();
    if (!tracker || !sig) return false;
    return safeEqual(String(sig), hmac("sha256", c.secretKey, String(tracker)));
  },

  // Webhook signature: header x-sfpy-signature = HMAC-SHA512 of JSON(body.data) with the webhook secret
  validWebhook: (req) => {
    const c = config();
    const signature = req.headers["x-sfpy-signature"];
    if (!c.webhookSecret || !signature || !req.body?.data) return false;
    return safeEqual(String(signature), hmac("sha512", c.webhookSecret, JSON.stringify(req.body.data)));
  },

  // 4: ask Safepay directly. Paid only if the tracker is finished AND belongs to us AND the amount matches.
  confirm: async (order) => {
    const c = config();
    if (!order.providerRef) return { paid: false, state: null };
    const res = await fetch(`${c.api}/order/v1/${encodeURIComponent(order.providerRef)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({})))?.data || {};
    const paid =
      res.ok &&
      PAID_STATES.includes(data.state) &&
      data.client === c.publicKey &&
      Number(data.amount) === order.amount &&
      data.currency === "PKR";
    return { paid, state: data.state || null, raw: { state: data.state, amount: data.amount, currency: data.currency } };
  },
};

module.exports = safepay;
