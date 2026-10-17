const prisma = require("../config/prisma");

const MAX_GROUP_MEMBERS = 256;

const userSelect = { id: true, name: true, email: true, avatarUrl: true, about: true };

// Sends a live socket event to several users (needs app.set("io", io) in the server file)
const emitToUsers = (req, userIds, event, payload) => {
  const io = req.app.get("io");
  userIds.forEach((id) => io?.to(`user:${id}`).emit(event, payload));
};

const formatGroup = (g) => ({
  conversationId: g.id,
  type: "GROUP",
  name: g.name,
  description: g.description,
  avatarUrl: g.avatarUrl,
  createdBy: g.createdBy,
  createdAt: g.createdAt,
  members: g.members.map((m) => ({
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt,
    user: m.user,
  })),
});

const loadGroup = (id) =>
  prisma.conversation.findFirst({
    where: { id, type: "GROUP" },
    include: {
      members: { include: { user: { select: userSelect } }, orderBy: { joinedAt: "asc" } },
    },
  });

const fresh = async (id) => formatGroup(await loadGroup(id));
const memberIdsOf = (group) => group.members.map((m) => m.userId);
const memberKey = (conversationId, userId) => ({ conversationId_userId: { conversationId, userId } });

// Loads the group and checks the user is a member (and an admin, if adminOnly).
// Sends the error response itself and returns null on failure.
async function getContext(req, res, adminOnly = false) {
  const id = Number(req.params.id);
  const group = Number.isInteger(id) ? await loadGroup(id) : null;
  const me = group?.members.find((m) => m.userId === req.user.id);

  const error = !group
    ? [404, "Group not found"]
    : !me
    ? [403, "You are not a member of this group"]
    : adminOnly && me.role !== "ADMIN"
    ? [403, "Only group admins can do this"]
    : null;

  if (error) {
    res.status(error[0]).json({ error: error[1] });
    return null;
  }
  return { group, me };
}

// Wraps a handler so each one doesn't need its own try/catch
const handler = (name, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error(`${name} error:`, error);
    res.status(500).json({ error: `Failed to ${name}` });
  }
};

// GET /api/conversations/group/:id
const getGroupInfo = handler("get group info", async (req, res) => {
  const ctx = await getContext(req, res);
  if (ctx) res.json(formatGroup(ctx.group));
});

// PATCH /api/conversations/group/:id   body: { name?, description?, avatarUrl? }  (admin)
const updateGroup = handler("update group", async (req, res) => {
  const ctx = await getContext(req, res, true);
  if (!ctx) return;

  const { name, description, avatarUrl } = req.body;
  const data = {};

  if (name !== undefined) {
    const clean = String(name).trim();
    if (clean.length < 2 || clean.length > 100) {
      return res.status(400).json({ error: "Group name must be between 2 and 100 characters" });
    }
    data.name = clean;
  }

  if (description !== undefined) {
    const clean = String(description ?? "").trim();
    if (clean.length > 500) {
      return res.status(400).json({ error: "Description must be 500 characters or less" });
    }
    data.description = clean || null;
  }

  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl ? String(avatarUrl) : null;

  if (!Object.keys(data).length) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  await prisma.conversation.update({ where: { id: ctx.group.id }, data });

  const updated = await fresh(ctx.group.id);
  emitToUsers(req, memberIdsOf(ctx.group), "groupUpdated", updated);
  res.json(updated);
});

// POST /api/conversations/group/:id/members   body: { userIds: [31, 32] }  (admin)
// New members only see messages sent after they joined.
const addMembers = handler("add members", async (req, res) => {
  const ctx = await getContext(req, res, true);
  if (!ctx) return;

  const existing = memberIdsOf(ctx.group);
  const ids = Array.isArray(req.body.userIds) ? [...new Set(req.body.userIds.map(Number))] : [];

  if (!ids.length || !ids.every(Number.isInteger)) {
    return res.status(400).json({ error: "userIds must be a list of valid ids" });
  }

  const toAdd = ids.filter((id) => !existing.includes(id));

  if (!toAdd.length) {
    return res.status(400).json({ error: "Those users are already in the group" });
  }
  if (existing.length + toAdd.length > MAX_GROUP_MEMBERS) {
    return res.status(400).json({ error: `A group can have at most ${MAX_GROUP_MEMBERS} members` });
  }
  if ((await prisma.user.count({ where: { id: { in: toAdd } } })) !== toAdd.length) {
    return res.status(400).json({ error: "One or more users were not found" });
  }

  const joinedAt = new Date();

  await prisma.conversationMember.createMany({
    // clearedAt = joinedAt hides everything sent before they joined
    data: toAdd.map((userId) => ({
      conversationId: ctx.group.id,
      userId,
      joinedAt,
      clearedAt: joinedAt,
      lastReadAt: joinedAt,
    })),
    skipDuplicates: true,
  });

  const updated = await fresh(ctx.group.id);
  emitToUsers(req, existing, "groupUpdated", updated);
  emitToUsers(req, toAdd, "addedToGroup", updated);
  res.json(updated);
});

// DELETE /api/conversations/group/:id/members/:userId  (admin)
const removeMember = handler("remove member", async (req, res) => {
  const ctx = await getContext(req, res, true);
  if (!ctx) return;

  const targetId = Number(req.params.userId);

  if (targetId === req.user.id) {
    return res.status(400).json({ error: "Use leave group to remove yourself" });
  }
  if (targetId === ctx.group.createdBy) {
    return res.status(403).json({ error: "The group creator cannot be removed" });
  }
  if (!memberIdsOf(ctx.group).includes(targetId)) {
    return res.status(404).json({ error: "That user is not in this group" });
  }

  await prisma.conversationMember.delete({ where: memberKey(ctx.group.id, targetId) });

  const updated = await fresh(ctx.group.id);
  emitToUsers(req, memberIdsOf(ctx.group).filter((id) => id !== targetId), "groupUpdated", updated);
  emitToUsers(req, [targetId], "removedFromGroup", { conversationId: ctx.group.id, reason: "removed" });
  res.json(updated);
});

// PATCH /api/conversations/group/:id/members/:userId   body: { role: "ADMIN" | "MEMBER" }  (admin)
const setRole = handler("change role", async (req, res) => {
  const ctx = await getContext(req, res, true);
  if (!ctx) return;

  const targetId = Number(req.params.userId);
  const { role } = req.body;

  if (!["ADMIN", "MEMBER"].includes(role)) {
    return res.status(400).json({ error: "Role must be ADMIN or MEMBER" });
  }
  if (!memberIdsOf(ctx.group).includes(targetId)) {
    return res.status(404).json({ error: "That user is not in this group" });
  }
  if (targetId === ctx.group.createdBy && role === "MEMBER") {
    return res.status(403).json({ error: "The group creator is always an admin" });
  }

  await prisma.conversationMember.update({
    where: memberKey(ctx.group.id, targetId),
    data: { role },
  });

  const updated = await fresh(ctx.group.id);
  emitToUsers(req, memberIdsOf(ctx.group), "groupUpdated", updated);
  res.json(updated);
});

// POST /api/conversations/group/:id/leave
// If the last admin leaves, the member who joined first becomes admin.
const leaveGroup = handler("leave group", async (req, res) => {
  const ctx = await getContext(req, res);
  if (!ctx) return;

  const me = req.user.id;
  await prisma.conversationMember.delete({ where: memberKey(ctx.group.id, me) });

  const rest = ctx.group.members.filter((m) => m.userId !== me);

  if (rest.length && !rest.some((m) => m.role === "ADMIN")) {
    await prisma.conversationMember.update({
      where: memberKey(ctx.group.id, rest[0].userId),
      data: { role: "ADMIN" },
    });
  }

  if (rest.length) {
    emitToUsers(req, rest.map((m) => m.userId), "groupUpdated", await fresh(ctx.group.id));
  }

  // also closes the group on the leaver's other tabs/devices
  emitToUsers(req, [me], "removedFromGroup", { conversationId: ctx.group.id, reason: "left" });
  res.json({ message: "You left the group" });
});

module.exports = { getGroupInfo, updateGroup, addMembers, removeMember, setRole, leaveGroup };