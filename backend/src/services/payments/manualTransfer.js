const { FRONTEND_URL } = require("./urls");

// "Send money yourself" payments: the user transfers to one of our accounts,
// sends the transaction ID + screenshot, and an admin approves it.
// Each account appears only when its details are set in backend/.env.
const ACCOUNTS = [
  {
    method: "BANK",
    label: "Bank transfer",
    fields: () => [
      ["Bank", process.env.MANUAL_BANK_NAME],
      ["Account title", process.env.MANUAL_BANK_TITLE],
      ["IBAN", process.env.MANUAL_BANK_IBAN],
      ["Account number", process.env.MANUAL_BANK_ACCOUNT_NO],
    ],
    required: () => process.env.MANUAL_BANK_IBAN || process.env.MANUAL_BANK_ACCOUNT_NO,
  },
  {
    method: "EASYPAISA",
    label: "Easypaisa",
    fields: () => [
      ["Easypaisa number", process.env.MANUAL_EASYPAISA_NUMBER],
      ["Account title", process.env.MANUAL_EASYPAISA_TITLE],
    ],
    required: () => process.env.MANUAL_EASYPAISA_NUMBER,
  },
  {
    method: "JAZZCASH_WALLET",
    label: "JazzCash",
    fields: () => [
      ["JazzCash number", process.env.MANUAL_JAZZCASH_NUMBER],
      ["Account title", process.env.MANUAL_JAZZCASH_TITLE],
    ],
    required: () => process.env.MANUAL_JAZZCASH_NUMBER,
  },
  {
    method: "RAAST",
    label: "Raast",
    fields: () => [
      ["Raast ID", process.env.MANUAL_RAAST_ID],
      ["Account title", process.env.MANUAL_RAAST_TITLE],
    ],
    required: () => process.env.MANUAL_RAAST_ID,
  },
];

// Only accounts that are filled in, with empty rows removed
const manualAccounts = () =>
  ACCOUNTS.filter((a) => a.required()).map((a) => ({
    method: a.method,
    label: a.label,
    details: a.fields().filter(([, value]) => value).map(([name, value]) => ({ name, value })),
  }));

const METHODS = ACCOUNTS.map((a) => a.method);

const manualTransfer = {
  id: "MANUAL",
  name: "Bank / wallet transfer",
  description: "Send money from your bank, Easypaisa or JazzCash app. We confirm it, usually within a few hours.",
  test: false,

  isEnabled: () => manualAccounts().length > 0,

  createCheckout: (order) => ({
    type: "redirect",
    url: `${FRONTEND_URL()}/checkout/manual/${order.id}`,
  }),
};

module.exports = { manualTransfer, manualAccounts, METHODS };
