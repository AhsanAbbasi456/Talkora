const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const STATUS_TOKEN_PURPOSE = "request-status";

// A "tracking pass": lets the browser check its own request status for 30 days.
// It is NOT a login token; the auth middleware and sockets reject anything with a purpose.
const makeStatusToken = (user) =>
  jwt.sign({ userId: user.id, purpose: STATUS_TOKEN_PURPOSE }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

const readStatusToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.purpose !== STATUS_TOKEN_PURPOSE) throw new Error("Wrong token type");
  return decoded.userId;
};

const ROLES = ["USER", "ADMIN"];
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "BANNED"];

const isAdminRole = (role) => role === "ADMIN";

// A suspension ends by itself once suspendedUntil has passed.
// Returns the user with the status they really have right now.
const refreshStatus = async (user) => {
  if (
    user.status === "SUSPENDED" &&
    user.suspendedUntil &&
    user.suspendedUntil <= new Date()
  ) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        status: "APPROVED",
        statusReason: null,
        suspendedUntil: null,
        statusChangedAt: new Date(),
      },
    });
  }
  return user;
};

// The text shown on the login screen when an account cannot sign in
const statusMessage = (user) => {
  switch (user.status) {
    case "PENDING":
      return "Your account is waiting for admin approval.";
    case "REJECTED":
      return "Your request to join Talkora was not approved.";
    case "SUSPENDED":
      return user.suspendedUntil
        ? `Your account is suspended until ${user.suspendedUntil.toUTCString()}.`
        : "Your account is suspended.";
    case "BANNED":
      return "Your account has been banned.";
    default:
      return "Your account cannot sign in.";
  }
};

// Body sent with a 403 when a non-approved account tries to use Talkora
const blockedResponse = (user) => ({
  message: statusMessage(user),
  accountStatus: user.status,
  reason: user.statusReason || null,
  suspendedUntil: user.suspendedUntil || null,
});

module.exports = {
  makeStatusToken,
  readStatusToken,
  ROLES,
  STATUSES,
  isAdminRole,
  refreshStatus,
  statusMessage,
  blockedResponse,
};
