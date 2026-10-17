const express = require("express");
const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", authenticate, async (req, res) => {
  try {
    const message = req.body.message?.trim();

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content:
                "Suggest exactly 3 short, natural replies in the same language as the message. If the message is in Urdu, write the replies in Urdu script, not Roman Urdu. Return one reply per line, without numbering.",
            },
            { role: "user", content: message.slice(0, 1000) },
          ],
          max_tokens:  250,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ message: "AI request failed" });
    }

    const suggestions = (data.choices?.[0]?.message?.content || "")
      .split("\n")
      .map((reply) => reply.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ message: "Could not generate smart replies" });
  }
});

module.exports = router;
