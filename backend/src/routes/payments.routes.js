const express = require("express");
const authenticate = require("../middleware/auth.middleware");
const {
  getPlans,
  getMyPlan,
  checkout,
  getOrder,
  completeTestPayment,
  jazzcashReturn,
  getManualCheckout,
  submitManualProof,
  safepayReturn,
  safepayCancel,
  safepayWebhook,
} = require("../controllers/payments.controller");
const { proofUpload } = require("../middleware/proofUpload");

const router = express.Router();

// JazzCash posts a normal HTML form here (no login; checked by signature)
router.post("/jazzcash/return", express.urlencoded({ extended: false }), jazzcashReturn);

// Safepay sends the user back (GET or POST) and calls the webhook (no login; checked with Safepay)
router.all("/safepay/return", express.urlencoded({ extended: false }), safepayReturn);
router.get("/safepay/cancel", safepayCancel);
router.post("/safepay/webhook", safepayWebhook);

router.use(authenticate);
router.get("/plans", getPlans);
router.get("/me", getMyPlan);
router.post("/checkout", checkout);
router.get("/orders/:id", getOrder);
router.post("/test/:id/complete", completeTestPayment);
router.get("/orders/:id/manual", getManualCheckout);
router.post("/orders/:id/manual-proof", (req, res, next) =>
  proofUpload.single("proof")(req, res, (err) =>
    err
      ? res.status(err.status || (err.code === "LIMIT_FILE_SIZE" ? 413 : 400)).json({
          error: err.code === "LIMIT_FILE_SIZE" ? "Screenshot must be under 5 MB" : err.message,
        })
      : next(),
  ),
  submitManualProof,
);

module.exports = router;
