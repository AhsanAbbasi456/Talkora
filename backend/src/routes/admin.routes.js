const express = require("express");
const authenticate = require("../middleware/auth.middleware");
const { isAdminRole } = require("../utils/access");
const {
  getMe,
  getStats,
  listUsers,
  getUser,
  setStatus,
  bulkStatus,
  setRole,
  forceLogout,
  listAudit,
  listCalls,
  listGroups,
  listPayments,
  grantPlus,
  revokePlus,
  getPaymentProof,
  approvePayment,
  rejectPayment,
} = require("../controllers/admin.controller");

const router = express.Router();

// Every admin route needs a logged-in, approved Admin
const requireAdmin = (req, res, next) =>
  isAdminRole(req.user?.role) ? next() : res.status(403).json({ error: "Admins only" });

router.use(authenticate, requireAdmin);

router.get("/me", getMe);
router.get("/stats", getStats);
router.get("/users", listUsers);
router.post("/users/bulk-status", bulkStatus);
router.get("/users/:id", getUser);
router.post("/users/:id/status", setStatus);
router.post("/users/:id/role", setRole);
router.post("/users/:id/logout", forceLogout);
router.get("/audit", listAudit);
router.get("/calls", listCalls);
router.get("/groups", listGroups);
router.get("/payments", listPayments);
router.get("/payments/:id/proof", getPaymentProof);
router.post("/payments/:id/approve", approvePayment);
router.post("/payments/:id/reject", rejectPayment);
router.post("/users/:id/plus", grantPlus);
router.delete("/users/:id/plus", revokePlus);

module.exports = router;
