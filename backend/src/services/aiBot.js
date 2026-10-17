const prisma = require("../config/prisma");

const BOT_ID = Number(process.env.AI_BOT_ID);
const BUSY = "Talkora AI is busy right now. Please try again.";
const SYSTEM =
  "You are Talkora AI, a friendly assistant inside a chat app. Keep answers short. Reply in the same language as the user.";
const COOLDOWN_MS = 8000; // 8 seconds between bot answers in the same chat
const lastAsked = new Map();

// asks OpenRouter, retries up to 3 times, returns null if all fail
const callAi = async (messages, system = SYSTEM) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
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
              { role: "system", content: system },
              ...messages,
            ],
            max_tokens: 400,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (response.ok && text) return text;

      console.error(`OpenRouter attempt ${attempt}:`, response.status, JSON.stringify(data).slice(0, 300));
    } catch (error) {
      console.error(`OpenRouter attempt ${attempt}:`, error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return null;
};

const askAi = async (conversationId, receiverId) => {
  // last 10 text messages = the bot's memory
  const history = await prisma.message.findMany({
    where: { conversationId, body: { not: null }, deletedForEveryone: false },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const messages = history.reverse().map((m) => ({
    role: m.senderId === BOT_ID ? "assistant" : "user",
    content: m.body,
  }));

    const now = Date.now();
  const waiting = now - (lastAsked.get(conversationId) || 0) < COOLDOWN_MS;
  if (!waiting) lastAsked.set(conversationId, now);

  const reply = waiting
    ? "Please wait a few seconds before asking again."
    : (await callAi(messages)) || BUSY;

  const botMessage = await prisma.message.create({
    data: { conversationId, senderId: BOT_ID, receiverId, body: reply },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: botMessage.createdAt },
  });

  return botMessage;
};

module.exports = { askAi, callAi };