const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    // Check if token exists
    if (!authHeader) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Check Bearer token
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Invalid token format",
      });
    }

    const token = parts[1];

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Store user ID in request
    req.userId = decoded.userId;

    // Continue to next route
    next();

  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

module.exports = protect;