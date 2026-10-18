const crypto = require("crypto");
const { BACKEND_URL } = require("./urls");

// JazzCash "Page Redirection" (Hosted Checkout): the user pays on JazzCash's own page
// with their wallet or a card, then JazzCash posts the result back to our server.
//
// Needs in backend/.env:
//   JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD, JAZZCASH_INTEGRITY_SALT
//   JAZZCASH_ENV=sandbox (default) or live
//
// Field names, URLs and response codes follow JazzCash's merchant integration guide.
// Confirm them against the current sandbox documentation before going live.

const HOSTS = {
  sandbox: "https://sandbox.jazzcash.com.pk",
  live: "https://payments.jazzcash.com.pk",
};

const config = () => ({
  merchantId: process.env.JAZZCASH_MERCHANT_ID,
  password: process.env.JAZZCASH_PASSWORD,
  salt: process.env.JAZZCASH_INTEGRITY_SALT,
  host: HOSTS[process.env.JAZZCASH_ENV === "live" ? "live" : "sandbox"],
});

// yyyyMMddHHmmss in Pakistan time (UTC+5), the format JazzCash expects
const pktStamp = (date) =>
  new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString().replace(/\D/g, "").slice(0, 14);

// pp_SecureHash: HMAC-SHA256 (key = integrity salt) over
// "salt&value1&value2..." using every non-empty pp_/ppmpf_ field sorted by name
const secureHash = (fields, salt) => {
  const values = Object.keys(fields)
    .filter((k) => /^(pp_|ppmpf_)/i.test(k) && k.toLowerCase() !== "pp_securehash")
    .sort()
    .map((k) => fields[k])
    .filter((v) => v !== undefined && v !== null && String(v) !== "");
  const message = [salt, ...values].join("&");
  return crypto.createHmac("sha256", salt).update(message).digest("hex").toUpperCase();
};

const sameHash = (a = "", b = "") =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Response codes (see JazzCash docs): 000/121 = paid, 124/157 = waiting (e.g. voucher)
const PAID_CODES = ["000", "121"];
const WAITING_CODES = ["124", "157"];

const jazzcash = {
  id: "JAZZCASH",
  name: "JazzCash",
  description: "Pay with your JazzCash wallet or a debit/credit card",
  test: false,

  isEnabled: () => {
    const c = config();
    return Boolean(c.merchantId && c.password && c.salt);
  },

  // Our page builds an HTML form with these fields and submits it to JazzCash
  createCheckout: (order, user) => {
    const c = config();
    const now = new Date();
    const fields = {
      pp_Version: "1.1",
      pp_TxnType: "", // empty = JazzCash shows all methods (wallet, card)
      pp_Language: "EN",
      pp_MerchantID: c.merchantId,
      pp_SubMerchantID: "",
      pp_Password: c.password,
      pp_BankID: "",
      pp_ProductID: "",
      pp_TxnRefNo: order.id,
      pp_Amount: String(order.amount * 100), // in paisa
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: pktStamp(now),
      pp_TxnExpiryDateTime: pktStamp(new Date(now.getTime() + 60 * 60 * 1000)),
      pp_BillReference: `user${user.id}`,
      pp_Description: `Talkora Plus ${order.days} days`,
      pp_ReturnURL: `${BACKEND_URL()}/api/payments/jazzcash/return`,
      ppmpf_1: "",
      ppmpf_2: "",
      ppmpf_3: "",
      ppmpf_4: "",
      ppmpf_5: "",
    };
    fields.pp_SecureHash = secureHash(fields, c.salt);

    return {
      type: "form",
      url: `${c.host}/CustomerPortal/transactionmanagement/merchantform/`,
      fields,
    };
  },

  // Checks the answer JazzCash posted to our return URL
  readReturn: (body) => {
    const c = config();
    const valid = sameHash(String(body.pp_SecureHash || "").toUpperCase(), secureHash(body, c.salt));
    const code = String(body.pp_ResponseCode || "");
    return {
      valid,
      orderId: String(body.pp_TxnRefNo || ""),
      amountPaisa: Number(body.pp_Amount),
      code,
      paid: PAID_CODES.includes(code),
      waiting: WAITING_CODES.includes(code),
      message: body.pp_ResponseMessage || "Payment was not completed",
      providerRef: body.pp_RetreivalReferenceNo || body.pp_RetrievalReferenceNo || null,
    };
  },

  // Asks JazzCash directly whether an order is paid (never trust the browser alone)
  inquire: async (orderId) => {
    const c = config();
    const fields = { pp_TxnRefNo: orderId, pp_MerchantID: c.merchantId, pp_Password: c.password };
    fields.pp_SecureHash = secureHash(fields, c.salt);

    const res = await fetch(`${c.host}/ApplicationAPI/API/PaymentInquiry/Inquire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const payCode = String(data.pp_PaymentResponseCode || "");
    return {
      ok: data.pp_ResponseCode === "000", // the inquiry itself worked
      paid:
        data.pp_ResponseCode === "000" &&
        (PAID_CODES.includes(payCode) || /completed/i.test(data.pp_Status || "")),
      waiting: WAITING_CODES.includes(payCode),
      message: data.pp_PaymentResponseMessage || data.pp_ResponseMessage || "",
      raw: data,
    };
  },
};

module.exports = jazzcash;
module.exports.secureHash = secureHash;
