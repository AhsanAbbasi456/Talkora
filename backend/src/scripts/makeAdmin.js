// Makes an existing account an Admin (use it for the first admin).
// Usage (from backend/):  node src/scripts/makeAdmin.js you@example.com
require("dotenv/config");
const prisma = require("../config/prisma");

(async () => {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: node src/scripts/makeAdmin.js <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account with email ${email}. Register first, then run this again.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN", status: "APPROVED", statusReason: null, suspendedUntil: null },
  });
  await prisma.auditLog.create({
    data: { actorId: null, targetId: user.id, action: "ROLE_CHANGED", details: { from: user.role, to: "ADMIN", via: "script" } },
  });

  console.log(`${user.name} <${email}> is now an Admin. Log out and back in to see the admin page.`);
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
