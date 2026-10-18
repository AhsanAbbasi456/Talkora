const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { refreshStatus, blockedResponse } = require("../utils/access");

async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose) throw new Error("Not a login token"); // e.g. a request-tracking pass
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        status: true,
        statusReason: true,
        suspendedUntil: true,
        tokenVersion: true,
      },
    });

    // "Log out everywhere" bumps tokenVersion, which invalidates older tokens
    if (!user || (decoded.tv ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    user = await refreshStatus(user);
    if (user.status !== "APPROVED") {
      return res.status(403).json({ ...blockedResponse(user), error: "Account is not active" });
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = authenticate;
