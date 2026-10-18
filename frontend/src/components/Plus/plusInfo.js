// Shown in the Upgrade window before the server's plan list has loaded.
// The real price is always decided by the server at checkout.
export const PLUS_PRICE_LABEL = "Rs 499 for 30 days · no auto-renew";

export const PLUS_FEATURES = [
  "Unlimited Talkora AI questions",
  "Summarize any chat with AI",
  "Translate messages (English ↔ Urdu)",
  "Send files up to 50 MB",
];

export const formatPkr = (amount) => `Rs ${Number(amount || 0).toLocaleString("en-PK")}`;

export const PROVIDER_LABELS = {
  SAFEPAY: "Card (Safepay)",
  JAZZCASH: "JazzCash",
  MANUAL: "Bank / wallet transfer",
  TEST: "Test payment",
  ADMIN: "Gift from admin",
};

// how a manual transfer was sent
export const METHOD_LABELS = {
  BANK: "Bank transfer",
  EASYPAISA: "Easypaisa",
  JAZZCASH_WALLET: "JazzCash",
  RAAST: "Raast",
};
