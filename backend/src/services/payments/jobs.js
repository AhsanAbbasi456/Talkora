const prisma = require("../../config/prisma");
const { sendEmail } = require("../mailer");
const { expireStaleOrders } = require("./orders");

const HOUR_MS = 60 * 60 * 1000;
const REMIND_BEFORE_MS = 3 * 24 * HOUR_MS; // "your Plus ends in 3 days"

const sendExpiryReminders = async () => {
  const soon = await prisma.user.findMany({
    where: {
      plusUntil: { gt: new Date(), lt: new Date(Date.now() + REMIND_BEFORE_MS) },
      plusReminderSentAt: null,
    },
    select: { id: true, name: true, email: true, plusUntil: true },
  });

  for (const user of soon) {
    await prisma.user.update({ where: { id: user.id }, data: { plusReminderSentAt: new Date() } });
    sendEmail({
      to: user.email,
      subject: "Your Talkora Plus ends soon",
      text: `Hi ${user.name}, your Talkora Plus ends on ${user.plusUntil.toUTCString()}. Renew any time from Billing to keep unlimited AI, Summarize, Translate and 50 MB files.`,
    }).catch((err) => console.error("Reminder email failed:", err.message));
  }
};

// Runs every hour: expire unpaid orders, remind people whose Plus ends soon
const startPaymentJobs = () => {
  const run = () =>
    Promise.all([expireStaleOrders(), sendExpiryReminders()]).catch((err) =>
      console.error("Payment jobs error:", err),
    );
  run();
  return setInterval(run, HOUR_MS);
};

module.exports = { startPaymentJobs };
