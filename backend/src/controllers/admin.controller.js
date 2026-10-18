const prisma = require("../config/prisma");
const { sendEmail } = require("../services/mailer");
const { STATUSES, blockedResponse } = require("../utils/access");
const { fulfillOrder, createOrder, publicOrder } = require("../services/payments/orders");
const path = require("path");
const { PROOF_DIR } = require("../middleware/proofUpload");

// Admins see counts, dates and names only. Message text, files and
// view-once media are never selected anywhere in this file.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SUSPEND_DAYS = 365;

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  about: true,
  role: true,
  status: true,
  statusReason: true,
  suspendedUntil: true,
  statusChangedAt: true,
  isOnline: true,
  lastSeen: true,
  createdAt: true,
  plusUntil: true,
};

const PERSON = { select: { id: true, name: true, email: true } };

const fail = (status, error) => {
  throw Object.assign(new Error(error), { status });
};

const handler = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error(`Admin ${label} error:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const toId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id)) fail(400, "Invalid user ID");
  return id;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Admins can change any account except their own
const assertCanManage = (actor, target) => {
  if (!target) fail(404, "User not found");
  if (actor.id === target.id) fail(403, "You cannot change your own account");
};

const audit = (actorId, targetId, action, details) =>
  prisma.auditLog.create({ data: { actorId, targetId, action, details } });

// Ends every open session of a user and tells their open tabs why
const kickUser = (io, userId, event, payload) => {
  const room = `user:${userId}`;
  io.to(room).emit(event, payload);
  io.in(room).disconnectSockets(true);
};

const STATUS_EMAILS = {
  APPROVED: {
    subject: "Your Talkora account is approved",
    text: () => "Good news! An admin approved your Talkora account. You can log in now.",
  },
  REJECTED: {
    subject: "Your Talkora request",
    text: (u) =>
      `Your request to join Talkora was not approved.${u.statusReason ? ` Reason: ${u.statusReason}` : ""}`,
  },
  SUSPENDED: {
    subject: "Your Talkora account is suspended",
    text: (u) =>
      `Your Talkora account has been suspended${
        u.suspendedUntil ? ` until ${u.suspendedUntil.toUTCString()}` : ""
      }.${u.statusReason ? ` Reason: ${u.statusReason}` : ""}`,
  },
  BANNED: {
    subject: "Your Talkora account is banned",
    text: (u) =>
      `Your Talkora account has been banned.${u.statusReason ? ` Reason: ${u.statusReason}` : ""}`,
  },
};

const emailStatus = (user) => {
  const mail = STATUS_EMAILS[user.status];
  if (!mail) return;
  sendEmail({ to: user.email, subject: mail.subject, text: mail.text(user) }).catch((err) =>
    console.error("Status email failed:", err.message),
  );
};

// Shared by the single and bulk endpoints
const applyStatus = async (req, target, { status, reason, days }) => {
  const actor = req.user;
  assertCanManage(actor, target);

  if (!STATUSES.includes(status) || status === "PENDING") fail(400, "Invalid status");
  if (status === "REJECTED" && target.status !== "PENDING") {
    fail(400, "Only pending requests can be rejected");
  }
  if (status === target.status && status !== "SUSPENDED") {
    fail(400, `User is already ${status.toLowerCase()}`);
  }

  let suspendedUntil = null;
  if (status === "SUSPENDED" && days !== undefined && days !== null && days !== "") {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > MAX_SUSPEND_DAYS) {
      fail(400, `Suspension must be 1-${MAX_SUSPEND_DAYS} days`);
    }
    suspendedUntil = new Date(Date.now() + n * DAY_MS);
  }

  const cleanReason =
    status === "APPROVED" ? null : typeof reason === "string" ? reason.trim().slice(0, 300) || null : null;

  const losesAccess = status !== "APPROVED";

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      status,
      statusReason: cleanReason,
      suspendedUntil,
      statusChangedAt: new Date(),
      // old tokens stop working the moment access is taken away
      ...(losesAccess ? { tokenVersion: { increment: 1 } } : {}),
    },
    select: { ...USER_SELECT },
  });

  await audit(actor.id, target.id, `USER_${status}`, {
    from: target.status,
    to: status,
    ...(cleanReason ? { reason: cleanReason } : {}),
    ...(suspendedUntil ? { until: suspendedUntil } : {}),
  });

  const io = req.app.get("io");
  if (losesAccess) kickUser(io, target.id, "accountStatus", blockedResponse(updated));
  io.to("admins").emit("admin:userUpdated", { id: target.id });

  emailStatus(updated);

  return updated;
};

// ==========================================
// GET /api/admin/me
// ==========================================
const getMe = handler("me", async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true },
  });
  res.json({ user: me });
});

// ==========================================
// GET /api/admin/stats
// ==========================================
const getStats = handler("stats", async (req, res) => {
  const today = startOfToday();
  const since = new Date(today.getTime() - 29 * DAY_MS);

  const [
    byStatus,
    byRole,
    onlineNow,
    totalMessages,
    messagesToday,
    messagesByType,
    totalCalls,
    callsToday,
    callSeconds,
    groups,
    directChats,
    signupsToday,
    signupRows,
    messageRows,
    pending,
    recentActions,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.count({ where: { isOnline: true, status: "APPROVED" } }),
    prisma.message.count(),
    prisma.message.count({ where: { createdAt: { gte: today } } }),
    prisma.message.groupBy({ by: ["messageType"], _count: { _all: true } }),
    prisma.call.count(),
    prisma.call.count({ where: { createdAt: { gte: today } } }),
    prisma.call.aggregate({ _sum: { durationSeconds: true } }),
    prisma.conversation.count({ where: { type: "GROUP" } }),
    prisma.conversation.count({ where: { type: "DIRECT" } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "User" WHERE "createdAt" >= ${since}
      GROUP BY day ORDER BY day`,
    prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "Message" WHERE "createdAt" >= ${since}
      GROUP BY day ORDER BY day`,
    prisma.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: PERSON, target: PERSON },
    }),
  ]);

  const countMap = (rows, key) =>
    Object.fromEntries(rows.map((r) => [r[key], r._count._all]));

  // one entry per day, including days with no activity
  const daily = (rows) => {
    const byDay = new Map(rows.map((r) => [new Date(r.day).toDateString(), r.count]));
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(since.getTime() + i * DAY_MS);
      return { date: day.toISOString(), count: byDay.get(day.toDateString()) || 0 };
    });
  };

  const users = countMap(byStatus, "status");

  res.json({
    users: {
      total: Object.values(users).reduce((a, b) => a + b, 0),
      byStatus: users,
      byRole: countMap(byRole, "role"),
      onlineNow,
      signupsToday,
    },
    messages: {
      total: totalMessages,
      today: messagesToday,
      byType: countMap(messagesByType, "messageType"),
    },
    calls: {
      total: totalCalls,
      today: callsToday,
      totalMinutes: Math.round((callSeconds._sum.durationSeconds || 0) / 60),
    },
    conversations: { groups, direct: directChats },
    series: { signups: daily(signupRows), messages: daily(messageRows) },
    pending,
    recentActions,
  });
});

// ==========================================
// GET /api/admin/users?status=&role=&q=&joined=today&page=&pageSize=
// ==========================================
const listUsers = handler("list users", async (req, res) => {
  const { status, role, q } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

  const where = {
    ...(status ? { status: String(status) } : {}),
    ...(role ? { role: String(role) } : {}),
    ...(req.query.joined === "today" ? { createdAt: { gte: startOfToday() } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: String(q), mode: "insensitive" } },
            { email: { contains: String(q), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      // the oldest request first, so nobody waits forever
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        ...USER_SELECT,
        _count: { select: { sentMessages: true, conversationMembers: true } },
      },
    }),
  ]);

  res.json({ users, total, page, pageSize });
});

// ==========================================
// GET /api/admin/users/:id
// ==========================================
const getUser = handler("get user", async (req, res) => {
  const id = toId(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...USER_SELECT,
      emailVerified: true,
      _count: {
        select: {
          sentMessages: true,
          receivedMessages: true,
          conversationMembers: true,
          createdGroups: true,
          callsMade: true,
          callsReceived: true,
          reactions: true,
          pollVotes: true,
        },
      },
    },
  });
  if (!user) fail(404, "User not found");

  const [byType, callTime, memberships, perConversation, history] = await Promise.all([
    prisma.message.groupBy({
      by: ["messageType"],
      where: { senderId: id },
      _count: { _all: true },
    }),
    prisma.call.aggregate({
      where: { OR: [{ callerId: id }, { calleeId: id }] },
      _sum: { durationSeconds: true },
    }),
    prisma.conversationMember.findMany({
      where: { userId: id },
      select: {
        role: true,
        joinedAt: true,
        conversation: {
          select: {
            id: true,
            type: true,
            name: true,
            lastMessageAt: true,
            members: { select: { user: { select: { id: true, name: true } } } },
            _count: { select: { messages: true, members: true } },
          },
        },
      },
    }),
    prisma.message.groupBy({
      by: ["conversationId"],
      where: { senderId: id },
      _count: { _all: true },
    }),
    prisma.auditLog.findMany({
      where: { targetId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: PERSON },
    }),
  ]);

  const sentIn = Object.fromEntries(perConversation.map((r) => [r.conversationId, r._count._all]));

  // chat list without any content: who, how many messages, last activity
  const conversations = memberships
    .map(({ role, joinedAt, conversation: c }) => ({
      id: c.id,
      type: c.type,
      name:
        c.type === "GROUP"
          ? c.name || "Unnamed group"
          : c.members.find((m) => m.user.id !== id)?.user.name || "Unknown user",
      otherUserId:
        c.type === "DIRECT" ? c.members.find((m) => m.user.id !== id)?.user.id ?? null : null,
      memberRole: role,
      joinedAt,
      memberCount: c._count.members,
      totalMessages: c._count.messages,
      sentByUser: sentIn[c.id] || 0,
      lastMessageAt: c.lastMessageAt,
    }))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

  res.json({
    user,
    stats: {
      messagesByType: Object.fromEntries(byType.map((r) => [r.messageType, r._count._all])),
      callMinutes: Math.round((callTime._sum.durationSeconds || 0) / 60),
    },
    conversations,
    history,
  });
});

// ==========================================
// POST /api/admin/users/:id/status   { status, reason?, days? }
// ==========================================
const setStatus = handler("set status", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: toId(req.params.id) } });
  const user = await applyStatus(req, target, req.body || {});
  res.json({ user });
});

// ==========================================
// POST /api/admin/users/bulk-status   { ids, status, reason?, days? }
// ==========================================
const bulkStatus = handler("bulk status", async (req, res) => {
  const { ids, ...change } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || ids.length > 100) {
    fail(400, "Send between 1 and 100 user IDs");
  }

  const targets = await prisma.user.findMany({ where: { id: { in: ids.map(toId) } } });
  const done = [];
  const skipped = [];

  for (const target of targets) {
    try {
      await applyStatus(req, target, change);
      done.push(target.id);
    } catch (error) {
      if (!error.status) throw error;
      skipped.push({ id: target.id, name: target.name, error: error.message });
    }
  }

  res.json({ done, skipped });
});

// ==========================================
// POST /api/admin/users/:id/role   { role }
// ==========================================
const setRole = handler("set role", async (req, res) => {
  const { role } = req.body || {};
  if (!["USER", "ADMIN"].includes(role)) fail(400, "Role must be USER or ADMIN");

  const target = await prisma.user.findUnique({ where: { id: toId(req.params.id) } });
  assertCanManage(req.user, target);
  if (target.role === role) fail(400, `User is already ${role.toLowerCase()}`);

  const user = await prisma.user.update({
    where: { id: target.id },
    data: { role },
    select: USER_SELECT,
  });

  await audit(req.user.id, target.id, "ROLE_CHANGED", { from: target.role, to: role });

  // update the user's open tabs without logging them out
  const io = req.app.get("io");
  const room = `user:${target.id}`;
  io.to(room).emit("roleChanged", { role });
  if (role === "ADMIN") io.in(room).socketsJoin("admins");
  else io.in(room).socketsLeave("admins");
  io.to("admins").emit("admin:userUpdated", { id: target.id });

  res.json({ user });
});

// ==========================================
// POST /api/admin/users/:id/logout   (log out of every device)
// ==========================================
const forceLogout = handler("force logout", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: toId(req.params.id) } });
  assertCanManage(req.user, target);

  await prisma.user.update({
    where: { id: target.id },
    data: { tokenVersion: { increment: 1 } },
  });
  await audit(req.user.id, target.id, "FORCE_LOGOUT", null);

  kickUser(req.app.get("io"), target.id, "sessionExpired", {
    message: "An admin signed you out. Please log in again.",
  });

  res.json({ ok: true });
});

// ==========================================
// GET /api/admin/calls?range=&status=&type=&userId=&page=
// Who called whom, when, how long. Calls are never recorded, so there is no content.
// ==========================================
const RANGES = { today: null, "7d": 7, "30d": 30, all: undefined };

const listCalls = handler("calls", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 30;
  const range = req.query.range in RANGES ? req.query.range : "all";

  const since =
    range === "today"
      ? startOfToday()
      : RANGES[range]
        ? new Date(startOfToday().getTime() - (RANGES[range] - 1) * DAY_MS)
        : null;

  const userId = req.query.userId ? toId(req.query.userId) : null;

  const where = {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(req.query.type ? { callType: String(req.query.type) } : {}),
    ...(userId ? { OR: [{ callerId: userId }, { calleeId: userId }] } : {}),
  };
  const listWhere = { ...where, ...(req.query.status ? { status: String(req.query.status) } : {}) };
  const person = { select: { id: true, name: true, email: true, avatarUrl: true } };

  const [total, calls, summary, byStatus, filterUser] = await Promise.all([
    prisma.call.count({ where: listWhere }),
    prisma.call.findMany({
      where: listWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { caller: person, callee: person },
    }),
    // summary ignores the status filter so the chips always show their counts
    prisma.call.aggregate({ where, _count: { _all: true }, _sum: { durationSeconds: true } }),
    prisma.call.groupBy({ by: ["status"], where, _count: { _all: true } }),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }) : null,
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
  const totalSeconds = summary._sum.durationSeconds || 0;
  const answered = statusCounts.completed || 0;

  res.json({
    calls,
    total,
    page,
    pageSize,
    range,
    user: filterUser,
    summary: {
      count: summary._count._all,
      totalSeconds,
      answered,
      averageSeconds: answered ? Math.round(totalSeconds / answered) : 0,
      byStatus: statusCounts,
    },
  });
});

// ==========================================
// GET /api/admin/groups?q=&page=
// ==========================================
const listGroups = handler("groups", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 20;
  const q = req.query.q ? String(req.query.q) : "";
  const where = {
    type: "GROUP",
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const [total, groups] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        lastMessageAt: true,
        creator: { select: { id: true, name: true } },
        members: {
          select: { role: true, user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { joinedAt: "asc" },
        },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  res.json({ groups, total, page, pageSize });
});

// ==========================================
// GET /api/admin/payments?status=&provider=&page=
// ==========================================
const listPayments = handler("payments", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 30;
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const where = {
    ...(req.query.status ? { status: String(req.query.status) } : {}),
    ...(req.query.provider ? { provider: String(req.query.provider) } : {}),
  };

  // test and admin-granted orders are not real money
  const real = { status: "PAID", provider: { notIn: ["TEST", "ADMIN"] } };

  const [total, orders, revenueAll, revenue30, byStatus, plusNow, paidToday] = await Promise.all([
    prisma.paymentOrder.count({ where }),
    prisma.paymentOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.paymentOrder.aggregate({ where: real, _sum: { amount: true }, _count: { _all: true } }),
    prisma.paymentOrder.aggregate({ where: { ...real, paidAt: { gte: since30 } }, _sum: { amount: true } }),
    prisma.paymentOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count({ where: { plusUntil: { gt: new Date() } } }),
    prisma.paymentOrder.count({ where: { status: "PAID", paidAt: { gte: startOfToday() } } }),
  ]);

  res.json({
    summary: {
      revenueTotal: revenueAll._sum.amount || 0,
      paidOrders: revenueAll._count._all,
      revenue30d: revenue30._sum.amount || 0,
      plusUsers: plusNow,
      paidToday,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    },
    orders: orders.map((o) => ({
      ...publicOrder(o),
      user: o.user,
      providerRef: o.providerRef,
      manualSender: o.manualSender,
      hasProof: Boolean(o.proofFile),
    })),
    total,
    page,
    pageSize,
  });
});

// ==========================================
// POST /api/admin/users/:id/plus   { days }  give Plus for free (e.g. testers)
// DELETE /api/admin/users/:id/plus           end Plus now
// ==========================================
const grantPlus = handler("grant plus", async (req, res) => {
  const days = Number(req.body?.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) fail(400, "Days must be 1-365");

  const target = await prisma.user.findUnique({ where: { id: toId(req.params.id) } });
  if (!target) fail(404, "User not found");

  // a free "order" keeps the user's billing history complete
  const order = await prisma.paymentOrder.update({
    where: { id: (await createOrder(target.id, "PLUS", "ADMIN")).id },
    data: { amount: 0, days },
  });
  const { plusUntil } = await fulfillOrder(order.id, {
    providerRef: `ADMIN-${req.user.id}`,
    io: req.app.get("io"),
  });

  await audit(req.user.id, target.id, "PLUS_GRANTED", { days, until: plusUntil });
  req.app.get("io").to("admins").emit("admin:userUpdated", { id: target.id });
  res.json({ plusUntil });
});

const revokePlus = handler("revoke plus", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: toId(req.params.id) } });
  if (!target) fail(404, "User not found");

  await prisma.user.update({ where: { id: target.id }, data: { plusUntil: null } });
  await audit(req.user.id, target.id, "PLUS_REVOKED", null);

  const io = req.app.get("io");
  io.to(`user:${target.id}`).emit("planUpdated", { plan: "FREE", plusUntil: null });
  io.to("admins").emit("admin:userUpdated", { id: target.id });
  res.json({ ok: true });
});

// ==========================================
// Manual transfers: GET proof screenshot, POST approve / reject
// ==========================================
const findReviewOrder = async (id) => {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: String(id) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!order || order.provider !== "MANUAL") fail(404, "Transfer order not found");
  return order;
};

const getPaymentProof = async (req, res) => {
  try {
    const order = await findReviewOrder(req.params.id);
    if (!order.proofFile) fail(404, "No screenshot for this order");
    const file = path.join(PROOF_DIR, path.basename(order.proofFile));
    res.setHeader("Cache-Control", "private, no-store");
    res.sendFile(file, (err) => err && !res.headersSent && res.status(404).json({ error: "Screenshot not found" }));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error("Admin proof error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const approvePayment = handler("approve payment", async (req, res) => {
  const order = await findReviewOrder(req.params.id);
  if (order.status !== "REVIEW") fail(409, `This order is ${order.status.toLowerCase()}, not waiting for review`);

  await prisma.paymentOrder.update({ where: { id: order.id }, data: { reviewedAt: new Date() } });
  const result = await fulfillOrder(order.id, { providerRef: order.manualTid, io: req.app.get("io") });
  if (result.alreadyHandled) fail(409, "This order was already handled");

  await audit(req.user.id, order.userId, "PAYMENT_APPROVED", { order: order.id, tid: order.manualTid, amount: order.amount });
  res.json({ ok: true, plusUntil: result.plusUntil });
});

const rejectPayment = handler("reject payment", async (req, res) => {
  const order = await findReviewOrder(req.params.id);
  const reason = String(req.body?.reason || "").trim().slice(0, 300) || "We couldn't find this payment in our account.";

  const changed = await prisma.paymentOrder.updateMany({
    where: { id: order.id, status: "REVIEW" },
    data: { status: "FAILED", failReason: reason, reviewedAt: new Date() },
  });
  if (!changed.count) fail(409, "This order is not waiting for review");

  await audit(req.user.id, order.userId, "PAYMENT_REJECTED", { order: order.id, tid: order.manualTid, reason });

  const io = req.app.get("io");
  io.to(`user:${order.userId}`).emit("planUpdated", { plan: null });
  io.to("admins").emit("admin:payment", { orderId: order.id });
  sendEmail({
    to: order.user.email,
    subject: `Talkora payment not confirmed · ${order.id}`,
    text: `Hi ${order.user.name}, we couldn't confirm your transfer (TID ${order.manualTid}) for order ${order.id}. Reason: ${reason}\nIf you did send the money, reply to this email with your receipt.`,
  }).catch((err) => console.error("Reject email failed:", err.message));

  res.json({ ok: true });
});

// ==========================================
// GET /api/admin/audit?page=&action=
// ==========================================
const listAudit = handler("audit", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 30;
  const where = req.query.action ? { action: String(req.query.action) } : {};

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: PERSON, target: PERSON },
    }),
  ]);

  res.json({ entries, total, page, pageSize });
});

module.exports = {
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
};
