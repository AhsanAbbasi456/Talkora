// ==========================================
// WEBRTC CALL SOCKET
// Handles WebRTC signaling + saves calls in the database
// ==========================================

const prisma = require("../config/prisma");

// userId -> id of the Call row they are in
const userCalls = new Map();
const directCalls = new Map();
const groupCalls = new Map();
const userGroupCalls = new Map();

async function deliverPendingCalls(io, userId) {
  const room = io.to(`user:${userId}`);
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  if (!sockets.length) return;

  for (const call of directCalls.values()) {
    if (
      call.calleeId === Number(userId) &&
      !call.answered &&
      !call.ended
    ) {
      room.emit("incomingCall", call.invitation);
    }
  }
}

const getGroupMember = (group, userId) =>
  group.members.find((member) => member.userId === userId);

const toParticipant = (member) => ({
  id: member.userId,
  name: member.user.name || "Talkora user",
  avatarUrl: member.user.avatarUrl || null,
});

async function finishGroupCall(io, session) {
  if (!session || session.finished) return;
  session.finished = true;
  groupCalls.delete(session.conversationId);

  for (const member of session.members) {
    io.to(`user:${member.id}`).emit("groupCallEnded", { callId: session.id });
  }
  for (const userId of session.participants.keys()) {
    userGroupCalls.delete(userId);
  }

  try {
    const status = session.connectedAt ? "completed" : "cancelled";
    const durationSeconds = session.connectedAt
      ? Math.max(0, Math.round((Date.now() - session.connectedAt) / 1000))
      : 0;
    const message = await prisma.message.create({
      data: {
        conversationId: session.conversationId,
        senderId: session.callerId,
        receiverId: null,
        messageType: "CALL",
        body: status,
        fileName: session.callType,
        duration: durationSeconds,
      },
    });

    await prisma.conversation.update({
      where: { id: session.conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    await prisma.conversationMember.updateMany({
      where: { conversationId: session.conversationId },
      data: { hidden: false },
    });

    const payload = {
      ...message,
      conversationType: "GROUP",
      conversationName: session.groupName,
    };
    for (const member of session.members) {
      io.to(`user:${member.id}`).emit(
        member.id === session.callerId ? "messageSent" : "newMessage",
        payload,
      );
    }
  } catch (error) {
    console.error("finishGroupCall error:", error);
  }
}

async function leaveGroupCall(io, session, userId) {
  if (!session || !session.participants.has(userId)) return;

  session.participants.delete(userId);
  userGroupCalls.delete(userId);
  for (const participantId of session.participants.keys()) {
    io.to(`user:${participantId}`).emit("groupParticipantLeft", {
      callId: session.id,
      participantId: userId,
    });
  }

  if (
    session.participants.size === 0 ||
    (session.participants.size === 1 && session.invited.size === 0)
  ) {
    await finishGroupCall(io, session);
  }
}

// Saves the finished call as a chat message and sends it to both users
async function logCallInChat(io, call, status, durationSeconds) {
  const a = call.callerId;
  const b = call.calleeId;

  let conversation = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: a } } },
        { members: { some: { userId: b } } },
      ],
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        type: "DIRECT",
        members: { create: [{ userId: a }, { userId: b }] },
      },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: a, // the caller
      receiverId: b,
      messageType: "CALL",
      body: status,
      fileName: call.callType,
      duration: durationSeconds,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: message.createdAt },
  });

  // show the chat again if someone had hidden it
  await prisma.conversationMember.updateMany({
    where: { conversationId: conversation.id },
    data: { hidden: false },
  });

  io.to(`user:${a}`).emit("messageSent", message);
  io.to(`user:${b}`).emit("newMessage", message);
}

// Closes the call in the database, calculates the duration
// and adds an entry to the chat.
// unansweredStatus is used only if nobody accepted the call.
async function finishCall(io, callId, unansweredStatus) {
  if (!callId) return null;

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call || call.endedAt) return null; // already finished

  userCalls.delete(call.callerId);
  userCalls.delete(call.calleeId);
  directCalls.delete(callId);

  const endedAt = new Date();
  const durationSeconds = call.answeredAt
    ? Math.max(0, Math.round((endedAt - call.answeredAt) / 1000))
    : 0;
  const status = call.answeredAt ? "completed" : unansweredStatus;

  await prisma.call.update({
    where: { id: callId },
    data: { status, endedAt, durationSeconds },
  });

  try {
    await logCallInChat(io, call, status, durationSeconds);
  } catch (error) {
    console.error("logCallInChat error:", error);
  }

  return call;
}

const registerCallSocket = (io, socket) => {
  // ==========================================
  // START CALL
  // Caller -> Receiver
  // ==========================================
  socket.on("callUser", async ({ receiverId, offer, callType }) => {
    try {
      const callerId = socket.userId;

      if (!callerId || !receiverId || !offer || !callType) {
        return;
      }

      const call = await prisma.call.create({
        data: {
          callerId: Number(callerId),
          calleeId: Number(receiverId),
          callType: callType === "video" ? "video" : "audio",
        },
      });

      userCalls.set(Number(callerId), call.id);
      userCalls.set(Number(receiverId), call.id);

      // the caller's name and photo, so the receiver can show them
      const caller = await prisma.user.findUnique({
        where: { id: Number(callerId) },
        select: { name: true, avatarUrl: true },
      });

      const invitation = {
        callId: call.id,
        callerId,
        receiverId,
        offer,
        callType,
        callerName: caller?.name || null,
        callerAvatarUrl: caller?.avatarUrl || null,
      };
      directCalls.set(call.id, {
        callerId: Number(callerId),
        calleeId: Number(receiverId),
        invitation,
        pendingCandidates: [],
        ringing: false,
        answered: false,
        ended: false,
      });

      await deliverPendingCalls(io, Number(receiverId));
    } catch (error) {
      console.error("callUser error:", error);
    }
  });

  // ==========================================
  // CALL RINGING
  // Receiver's device got the call -> tell the caller
  // ==========================================
  socket.on("callRinging", async ({ callerId, callId }) => {
    if (!callerId) {
      return;
    }

    try {
      const receiverId = Number(socket.userId);
      const activeCallId = userCalls.get(receiverId);
      if (!activeCallId || activeCallId !== callId) return;

      const call = directCalls.get(activeCallId);
      if (!call || call.calleeId !== receiverId || call.callerId !== Number(callerId)) return;

      if (!call.ringing) {
        call.ringing = true;
        await prisma.call.updateMany({
          where: { id: activeCallId, status: "calling", endedAt: null },
          data: { status: "ringing", ringingAt: new Date() },
        });
        io.to(`user:${callerId}`).emit("callRinging", {
          receiverId,
          callId: activeCallId,
        });
      }

      call.pendingCandidates.forEach((candidate) => {
        io.to(`user:${receiverId}`).emit("iceCandidate", {
          senderId: call.callerId,
          candidate,
        });
      });
      call.pendingCandidates = [];
    } catch (error) {
      console.error("callRinging error:", error);
    }
  });

  // ==========================================
  // ACCEPT CALL
  // Receiver -> Caller
  // ==========================================
  socket.on("acceptCall", async ({ callerId, answer }) => {
    try {
      if (!callerId || !answer) {
        return;
      }

      const receiverId = Number(socket.userId);
      const callId = userCalls.get(receiverId);
      const call = directCalls.get(callId);
      if (!call || call.callerId !== Number(callerId) || call.calleeId !== receiverId) return;
      call.answered = true;

      io.to(`user:${callerId}`).emit("callAccepted", {
        receiverId,
        answer,
      });
    } catch (error) {
      console.error("acceptCall error:", error);
    }
  });

  // ==========================================
  // WEBRTC CONNECTION ESTABLISHED
  // Either participant can report the peer connection becoming connected.
  // ==========================================
  socket.on("callConnected", async () => {
    try {
      const callId = userCalls.get(Number(socket.userId));
      if (!callId) return;

      await prisma.call.updateMany({
        where: { id: callId, endedAt: null, answeredAt: null },
        data: { status: "ongoing", answeredAt: new Date() },
      });
    } catch (error) {
      console.error("callConnected error:", error);
    }
  });

  // ==========================================
  // REJECT CALL
  // ==========================================
  socket.on("rejectCall", async ({ callerId }) => {
    try {
      if (!callerId) {
        return;
      }

      await finishCall(io, userCalls.get(Number(socket.userId)), "declined");

      io.to(`user:${callerId}`).emit("callRejected", {
        receiverId: socket.userId,
      });
    } catch (error) {
      console.error("rejectCall error:", error);
    }
  });

  // ==========================================
  // ICE CANDIDATE
  // ==========================================
  socket.on("iceCandidate", async ({ targetUserId, candidate }) => {
    try {
      if (!targetUserId || !candidate) {
        return;
      }

      const senderId = Number(socket.userId);
      const receiverId = Number(targetUserId);
      const callId = userCalls.get(senderId);
      const call = directCalls.get(callId);
      if (
        !call ||
        call.ended ||
        !(
          (call.callerId === senderId && call.calleeId === receiverId) ||
          (call.calleeId === senderId && call.callerId === receiverId)
        )
      ) return;

      const targetSockets = await io.in(`user:${receiverId}`).fetchSockets();
      if (
        senderId === call.callerId &&
        (!call.ringing || targetSockets.length === 0)
      ) {
        call.pendingCandidates.push(candidate);
        return;
      }

      io.to(`user:${targetUserId}`).emit("iceCandidate", {
        senderId,
        candidate,
      });
    } catch (error) {
      console.error("iceCandidate error:", error);
    }
  });

  // ==========================================
  // END CALL
  // ==========================================
  socket.on("endCall", async ({ targetUserId }) => {
    try {
      if (!targetUserId) {
        return;
      }

      // if the caller hangs up before anyone answers -> "cancelled"
      await finishCall(io, userCalls.get(Number(socket.userId)), "cancelled");

      io.to(`user:${targetUserId}`).emit("callEnded", {
        callerId: socket.userId,
      });
    } catch (error) {
      console.error("endCall error:", error);
    }
  });

  // ==========================================
  // GROUP CALLS
  // ==========================================
  socket.on("groupCallStart", async ({ conversationId, callType }) => {
    try {
      const callerId = Number(socket.userId);
      const groupId = Number(conversationId);
      if (!Number.isInteger(groupId) || !["audio", "video"].includes(callType)) {
        socket.emit("groupCallError", { error: "Invalid group call details" });
        return;
      }
      if (userCalls.has(callerId) || userGroupCalls.has(callerId)) {
        socket.emit("groupCallError", { error: "You are already in a call" });
        return;
      }

      const group = await prisma.conversation.findFirst({
        where: {
          id: groupId,
          type: "GROUP",
          members: { some: { userId: callerId } },
        },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      });
      if (!group) {
        socket.emit("groupCallError", { error: "Group not found or you are not a member" });
        return;
      }
      if (group.members.length < 2) {
        socket.emit("groupCallError", { error: "Group calls need at least 2 members" });
        return;
      }
      if (group.members.length > 8) {
        socket.emit("groupCallError", {
          error: "Peer-to-peer group calls support up to 8 members",
        });
        return;
      }
      if (groupCalls.has(groupId)) {
        socket.emit("groupCallError", { error: "A call is already active in this group" });
        return;
      }

      const callerMember = getGroupMember(group, callerId);
      const caller = toParticipant(callerMember);
      const session = {
        id: `${groupId}:${Date.now()}:${callerId}`,
        conversationId: groupId,
        groupName: group.name || "Group",
        callerId,
        callType,
        startedAt: Date.now(),
        connectedAt: null,
        members: group.members.map(toParticipant),
        participants: new Map([[callerId, caller]]),
        invited: new Set(group.members.filter((m) => m.userId !== callerId).map((m) => m.userId)),
        finished: false,
      };
      groupCalls.set(groupId, session);
      userGroupCalls.set(callerId, groupId);

      socket.emit("groupCallStarted", {
        callId: session.id,
        userId: callerId,
        participants: [caller],
      });
      for (const member of group.members) {
        if (member.userId === callerId) continue;
        io.to(`user:${member.userId}`).emit("groupCallIncoming", {
          callId: session.id,
          conversationId: groupId,
          groupName: session.groupName,
          callType,
          caller,
        });
      }
    } catch (error) {
      console.error("groupCallStart error:", error);
      socket.emit("groupCallError", { error: "Could not start group call" });
    }
  });

  socket.on("groupCallJoin", async ({ callId, conversationId }) => {
    try {
      const userId = Number(socket.userId);
      const groupId = Number(conversationId);
      const session = groupCalls.get(groupId);
      if (!session || session.id !== callId || !session.invited.has(userId)) {
        socket.emit("groupCallError", { error: "This group call is no longer available" });
        return;
      }
      if (userCalls.has(userId) || userGroupCalls.has(userId)) {
        socket.emit("groupCallError", { error: "You are already in a call" });
        return;
      }

      const group = await prisma.conversation.findFirst({
        where: {
          id: groupId,
          type: "GROUP",
          members: { some: { userId } },
        },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      });
      const member = group && getGroupMember(group, userId);
      if (!member) {
        socket.emit("groupCallError", { error: "You are no longer a member of this group" });
        return;
      }

      const participant = toParticipant(member);
      const existingParticipants = [...session.participants.values()];
      session.invited.delete(userId);
      session.participants.set(userId, participant);
      userGroupCalls.set(userId, groupId);
      socket.emit("groupCallJoined", {
        callId,
        userId,
        conversationId: groupId,
        callType: session.callType,
        groupName: session.groupName,
        callerId: session.callerId,
        participants: [...existingParticipants, participant],
      });
      for (const existingId of session.participants.keys()) {
        if (existingId === userId) continue;
        io.to(`user:${existingId}`).emit("groupParticipantJoined", {
          callId,
          participant,
        });
      }
    } catch (error) {
      console.error("groupCallJoin error:", error);
      socket.emit("groupCallError", { error: "Could not join group call" });
    }
  });

  socket.on("groupCallDecline", ({ callId, conversationId }) => {
    const groupId = Number(conversationId);
    const userId = Number(socket.userId);
    const session = groupCalls.get(groupId);
    if (session?.id === callId) {
      session.invited.delete(userId);
      if (!session.invited.size && session.participants.size === 1) {
        finishGroupCall(io, session);
      }
    }
  });

  socket.on("groupCallOffer", ({ callId, targetUserId, offer }) => {
    const groupId = userGroupCalls.get(Number(socket.userId));
    const session = groupCalls.get(groupId);
    const targetId = Number(targetUserId);
    if (
      !session ||
      session.id !== callId ||
      !session.participants.has(Number(socket.userId)) ||
      !session.participants.has(targetId) ||
      !offer
    ) return;

    io.to(`user:${targetId}`).emit("groupCallOffer", {
      callId,
      senderId: Number(socket.userId),
      offer,
    });
  });

  socket.on("groupCallAnswer", ({ callId, targetUserId, answer }) => {
    const groupId = userGroupCalls.get(Number(socket.userId));
    const session = groupCalls.get(groupId);
    const targetId = Number(targetUserId);
    if (
      !session ||
      session.id !== callId ||
      !session.participants.has(Number(socket.userId)) ||
      !session.participants.has(targetId) ||
      !answer
    ) return;

    io.to(`user:${targetId}`).emit("groupCallAnswer", {
      callId,
      senderId: Number(socket.userId),
      answer,
    });
  });

  socket.on("groupCallIceCandidate", ({ callId, targetUserId, candidate }) => {
    const groupId = userGroupCalls.get(Number(socket.userId));
    const session = groupCalls.get(groupId);
    const targetId = Number(targetUserId);
    if (
      !session ||
      session.id !== callId ||
      !session.participants.has(Number(socket.userId)) ||
      !session.participants.has(targetId) ||
      !candidate
    ) return;

    io.to(`user:${targetId}`).emit("groupCallIceCandidate", {
      callId,
      senderId: Number(socket.userId),
      candidate,
    });
  });

  socket.on("groupCallConnected", ({ callId }) => {
    const groupId = userGroupCalls.get(Number(socket.userId));
    const session = groupCalls.get(groupId);
    if (!session || session.id !== callId || !session.participants.has(Number(socket.userId))) return;
    session.connectedAt ||= Date.now();
  });

  socket.on("groupCallLeave", ({ callId }) => {
    const userId = Number(socket.userId);
    const groupId = userGroupCalls.get(userId);
    const session = groupCalls.get(groupId);
    if (session?.id === callId) leaveGroupCall(io, session, userId);
  });

  // ==========================================
  // USER CLOSED THE TAB / LOST INTERNET
  // ==========================================
  socket.on("disconnect", async () => {
    try {
      const groupId = userGroupCalls.get(Number(socket.userId));
      const groupSession = groupCalls.get(groupId);
      if (groupSession) await leaveGroupCall(io, groupSession, Number(socket.userId));

      const callId = userCalls.get(Number(socket.userId));
      if (!callId) return;

      const call = await finishCall(io, callId, "cancelled");
      if (!call) return;

      const otherUserId =
        call.callerId === Number(socket.userId) ? call.calleeId : call.callerId;

      io.to(`user:${otherUserId}`).emit("callEnded", {
        callerId: socket.userId,
      });
    } catch (error) {
      console.error("call disconnect error:", error);
    }
  });
};

module.exports = registerCallSocket;
module.exports.deliverPendingCalls = deliverPendingCalls;