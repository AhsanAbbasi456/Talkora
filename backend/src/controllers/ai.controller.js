const prisma = require("../config/prisma");
const { callAi } = require("../services/aiBot");
const BOT_ID = Number(process.env.AI_BOT_ID);
const getAiChat = async (req, res) => {
  try {
    // tries the common names, until we confirm which one your middleware uses
    const userId = req.user?.userId ?? req.user?.id ?? req.userId;

    let chat = await prisma.conversation.findFirst({
      where: {
        type: "DIRECT",
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: BOT_ID } } },
        ],
      },
    });

    if (!chat) {
      chat = await prisma.conversation.create({
        data: {
          type: "DIRECT",
          members: { create: [{ userId }, { userId: BOT_ID }] },
        },
      });
    }

    res.json({ conversationId: chat.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not open AI chat" });
  }
};
const translateMessage = async (req, res) => {
  const text = req.body.text?.trim();
  if (!text) return res.status(400).json({ message: "Text is required" });

  const translation = await callAi(
    [{ role: "user", content: text.slice(0, 1000) }],
    "You are a translator. Translate the user's message to English. If it is already English, translate it to Urdu (Urdu script, not Roman Urdu). Return only the translation, nothing else.",
  );

  if (!translation)
    return res.status(502).json({ message: "Translation failed" });

  res.json({ translation });
};
const summarizeChat = async (req, res) => {
  try {
    const userId = req.user?.userId ?? req.user?.id ?? req.userId;
    const conversationId = Number(req.body.conversationId);

    // only members of the chat can summarize it
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) return res.status(403).json({ message: "Not allowed" });

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        messageType: "TEXT",
        body: { not: null },
        deletedForEveryone: false,
        NOT: { deletedFor: { has: userId } },
        ...(member.clearedAt ? { createdAt: { gt: member.clearedAt } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { sender: { select: { name: true } } },
    });

    if (messages.length < 3)
      return res.json({ summary: "Not enough messages to summarize yet." });

    const text = messages
      .reverse()
      .map((m) => `${m.sender.name}: ${m.body}`)
      .join("\n")
      .slice(0, 6000);

    const summary = await callAi(
      [{ role: "user", content: text }],
      "Summarize this chat in 3 to 5 short bullet points. Use the same language as most of the messages. Mention who said what when it helps. Return only the summary.",
    );

    if (!summary) return res.status(502).json({ message: "Summary failed" });

    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not summarize chat" });
  }
};
module.exports = { getAiChat, translateMessage, summarizeChat };