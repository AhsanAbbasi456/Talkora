const { getPlanUser, isPlus } = require("../services/plans");

// Blocks a route for Free users. 402 = "Payment Required"; the frontend opens the Upgrade window.
const requirePlus = (feature) => async (req, res, next) => {
  try {
    if (isPlus(await getPlanUser(req.user.id))) return next();
    res.status(402).json({
      error: `${feature} is a Talkora Plus feature`,
      message: `${feature} is a Talkora Plus feature`,
      code: "PLUS_REQUIRED",
      feature,
    });
  } catch (err) {
    console.error("Plan check error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = requirePlus;
