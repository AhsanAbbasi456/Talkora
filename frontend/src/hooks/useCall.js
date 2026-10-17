import { useState, useRef, useEffect } from "react";
import socket from "../socket";
import { listen } from "../utils/socketListen";
import { createPeerConnection } from "../utils/webrtc";

const sameId = (a, b) => Number(a) === Number(b);

const getStream = (callType) =>
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: callType === "video",
  });

const toPeer = (chat) => ({
  id: chat.id,
  name: chat.name,
  avatarUrl: chat.avatarUrl,
});

const errorText = (error) => {
  if (error?.name === "NotAllowedError")
    return "Allow camera and microphone access to make calls";
  if (error?.name === "NotFoundError") return "No camera or microphone found";
  if (error?.name === "NotReadableError")
    return "Camera or microphone is being used by another app";
  return "Could not start the call";
};

export default function useCall(activeChat) {
  const [incoming, setIncoming] = useState(null); // { callerId, offer, callType, peer }
  const [call, setCall] = useState(null); // { peer, callType, status: "calling" | "ringing" | "connected" }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  const callRef = useRef(call);
  const incomingRef = useRef(incoming);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const userIdRef = useRef(null);
  const pendingRef = useRef([]); // ICE candidates that arrived before the call was set up
  const groupPeersRef = useRef(new Map());
  const groupCandidatesRef = useRef(new Map());
  const chatRef = useRef(activeChat);
  chatRef.current = activeChat;

  const closeCall = () => {
    callRef.current = null;
    peerRef.current?.close();
    groupPeersRef.current.forEach((connection) => connection.close());
    groupPeersRef.current.clear();
    groupCandidatesRef.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    peerRef.current = null;
    streamRef.current = null;
    userIdRef.current = null;
    pendingRef.current = [];
    setCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setRemotePeers([]);
    setMuted(false);
    setCameraOff(false);
    setSeconds(0);
  };

  const fail = (error) => {
    console.error("Call error:", error);
    closeCall();
    setError(errorText(error));
  };

  const setupPeer = async (callType, peer, status) => {
    const stream = await getStream(callType);
    const pc = createPeerConnection(
      (candidate) =>
        socket.emit("iceCandidate", { targetUserId: peer.id, candidate }),
      setRemoteStream,
    );
    pc.onconnectionstatechange = () => {
      if (peerRef.current !== pc || pc.connectionState !== "connected") return;

      setCall((current) => (current ? { ...current, status: "connected" } : current));
      socket.emit("callConnected");
    };
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    peerRef.current = pc;
    streamRef.current = stream;
    userIdRef.current = peer.id;
    setLocalStream(stream);
    const nextCall = { peer, callType, status };
    callRef.current = nextCall;
    setCall(nextCall);
    return pc;
  };

  const flushCandidates = async () => {
    const pc = peerRef.current;
    const queued = pendingRef.current;
    pendingRef.current = [];
    for (const c of queued) await pc?.addIceCandidate(c);
  };

  const startCall = async (callType) => {
    const chat = chatRef.current;
    if (
      !chat ||
      peerRef.current ||
      groupPeersRef.current.size ||
      callRef.current ||
      streamRef.current ||
      incomingRef.current
    ) return;

    try {
      if (chat.type === "GROUP") {
        const stream = await getStream(callType);
        streamRef.current = stream;
        setLocalStream(stream);
        const nextCall = {
          peer: { id: chat.conversationId, name: chat.name, avatarUrl: chat.avatarUrl },
          callType,
          status: "calling",
          group: true,
          participants: [],
        };
        callRef.current = nextCall;
        setCall(nextCall);
        socket.emit("groupCallStart", {
          conversationId: chat.conversationId,
          callType,
        });
        return;
      }

      const pc = await setupPeer(callType, toPeer(chat), "calling");
      await pc.setLocalDescription(await pc.createOffer());
      socket.emit("callUser", {
        receiverId: chat.id,
        offer: pc.localDescription,
        callType,
      });
    } catch (error) {
      fail(error);
    }
  };

  const acceptCall = async () => {
    if (!incoming) return;
    if (incoming.groupCall) {
      try {
        const stream = await getStream(incoming.callType);
        streamRef.current = stream;
        setLocalStream(stream);
        socket.emit("groupCallJoin", {
          callId: incoming.callId,
          conversationId: incoming.conversationId,
        });
        setIncoming(null);
        incomingRef.current = null;
      } catch (error) {
        fail(error);
        socket.emit("groupCallDecline", {
          callId: incoming.callId,
          conversationId: incoming.conversationId,
        });
        setIncoming(null);
        incomingRef.current = null;
      }
      return;
    }

    const { callerId, offer, callType, peer } = incoming;
    setIncoming(null);
    incomingRef.current = null;

    try {
      const pc = await setupPeer(callType, peer, "connecting");
      await pc.setRemoteDescription(offer);
      await flushCandidates();
      await pc.setLocalDescription(await pc.createAnswer());
      socket.emit("acceptCall", { callerId, answer: pc.localDescription });
    } catch (error) {
      fail(error);
      socket.emit("rejectCall", { callerId }); // so the caller is not stuck on "Calling..."
    }
  };

  const rejectCall = () => {
    if (!incoming) return;
    if (incoming.groupCall) {
      socket.emit("groupCallDecline", {
        callId: incoming.callId,
        conversationId: incoming.conversationId,
      });
      setIncoming(null);
      incomingRef.current = null;
      return;
    }
    socket.emit("rejectCall", { callerId: incoming.callerId });
    pendingRef.current = [];
    setIncoming(null);
    incomingRef.current = null;
  };

  const endCall = () => {
    if (call?.group) {
      socket.emit("groupCallLeave", { callId: call.callId });
    } else if (userIdRef.current) {
      socket.emit("endCall", { targetUserId: userIdRef.current });
    }
    closeCall();
  };

  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const toggleCamera = () => {
    const next = !cameraOff;
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  };

  // socket events
  useEffect(() => {
    const onIncoming = (data) => {
      if (incomingRef.current?.callId === data.callId) {
        socket.emit("callRinging", {
          callerId: data.callerId,
          callId: data.callId,
        });
        return;
      }

      // already in a call -> decline automatically
      if (
        peerRef.current ||
        groupPeersRef.current.size ||
        callRef.current ||
        streamRef.current ||
        incomingRef.current
      ) {
        return socket.emit("rejectCall", { callerId: data.callerId });
      }

      const chat = chatRef.current;
      const peer =
        chat && sameId(chat.id, data.callerId)
          ? toPeer(chat)
          : {
              id: data.callerId,
              name: data.callerName || "Talkora user", // NEW: real name from the server
              avatarUrl: data.callerAvatarUrl || null, // NEW: real photo from the server
            };

      setIncoming({ ...data, peer });
      incomingRef.current = { ...data, peer };
      socket.emit("callRinging", {
        callerId: data.callerId,
        callId: data.callId,
      });
    };

    const peerForGroup = (id) => {
      const activeMember = callRef.current?.participants?.find((item) =>
        sameId(item.id, id),
      );
      if (activeMember) return activeMember;

      const chat = chatRef.current;
      const member = chat?.members?.find((item) => sameId(item.userId, id));
      return member
        ? {
            id: member.userId,
            name: member.user?.name || "Talkora user",
            avatarUrl: member.user?.avatarUrl || null,
          }
        : { id, name: "Talkora user", avatarUrl: null };
    };

    const connectGroupPeer = async (peer, offerer) => {
      const activeCall = callRef.current;
      const stream = streamRef.current;
      if (!activeCall?.group || !stream || groupPeersRef.current.has(Number(peer.id))) return;

      const pc = createPeerConnection(
        (candidate) =>
          socket.emit("groupCallIceCandidate", {
            callId: activeCall.callId,
            targetUserId: peer.id,
            candidate,
          }),
        (remote) => {
          setRemotePeers((current) => [
            ...current.filter((item) => !sameId(item.peer.id, peer.id)),
            { peer, stream: remote },
          ]);
        },
      );
      pc.onconnectionstatechange = () => {
        if (pc.connectionState !== "connected") return;
        const current = callRef.current;
        if (current) {
          callRef.current = { ...current, status: "connected" };
          setCall(callRef.current);
        }
        socket.emit("groupCallConnected", { callId: activeCall.callId });
      };
      groupPeersRef.current.set(Number(peer.id), pc);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (offerer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("groupCallOffer", {
          callId: activeCall.callId,
          targetUserId: peer.id,
          offer: pc.localDescription,
        });
      }
    };

    const onGroupIncoming = (data) => {
      if (
        peerRef.current ||
        groupPeersRef.current.size ||
        callRef.current ||
        incomingRef.current
      ) {
        socket.emit("groupCallDecline", {
          callId: data.callId,
          conversationId: data.conversationId,
        });
        return;
      }
      setIncoming({
        ...data,
        groupCall: true,
        peer: {
          id: data.conversationId,
          name: data.groupName,
          avatarUrl: null,
        },
      });
      incomingRef.current = { ...data, groupCall: true };
    };

    const onGroupStarted = ({ callId, userId, participants }) => {
      userIdRef.current = userId;
      const current = callRef.current;
      if (!current?.group) return;
      callRef.current = { ...current, callId, selfId: userId, participants };
      setCall(callRef.current);
    };

    const onGroupJoined = async (data) => {
      const participants = data.participants || [];
      userIdRef.current = data.userId;
      const peer = {
        id: data.conversationId,
        name: data.groupName,
        avatarUrl: null,
      };
      const nextCall = {
        peer,
        callType: data.callType,
        status: "connecting",
        group: true,
        callId: data.callId,
        selfId: data.userId,
        participants,
      };
      callRef.current = nextCall;
      setCall(nextCall);
      setIncoming(null);
      incomingRef.current = null;
      await Promise.all(
        participants
          .filter((participant) => !sameId(participant.id, data.userId))
          .map((participant) => connectGroupPeer(participant, true)),
      );
    };

    const onGroupParticipantJoined = ({ callId, participant }) => {
      if (callRef.current?.callId !== callId) return;
      callRef.current = {
        ...callRef.current,
        participants: [
          ...(callRef.current.participants || []).filter(
            (item) => !sameId(item.id, participant.id),
          ),
          participant,
        ],
      };
      setCall(callRef.current);
    };

    const onGroupOffer = async ({ callId, senderId, offer }) => {
      if (callRef.current?.callId !== callId) return;
      const peer = peerForGroup(senderId);
      await connectGroupPeer(peer, false);
      const pc = groupPeersRef.current.get(Number(senderId));
      if (!pc) return;
      await pc.setRemoteDescription(offer);
      const queued = groupCandidatesRef.current.get(Number(senderId)) || [];
      groupCandidatesRef.current.delete(Number(senderId));
      for (const candidate of queued) await pc.addIceCandidate(candidate);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("groupCallAnswer", {
        callId,
        targetUserId: senderId,
        answer: pc.localDescription,
      });
    };

    const onGroupAnswer = async ({ callId, senderId, answer }) => {
      if (callRef.current?.callId !== callId) return;
      const pc = groupPeersRef.current.get(Number(senderId));
      if (!pc) return;
      await pc.setRemoteDescription(answer);
      const queued = groupCandidatesRef.current.get(Number(senderId)) || [];
      groupCandidatesRef.current.delete(Number(senderId));
      for (const candidate of queued) await pc.addIceCandidate(candidate);
    };

    const onGroupIceCandidate = async ({ callId, senderId, candidate }) => {
      if (callRef.current?.callId !== callId || !candidate) return;
      const pc = groupPeersRef.current.get(Number(senderId));
      if (pc?.remoteDescription) await pc.addIceCandidate(candidate);
      else {
        const queued = groupCandidatesRef.current.get(Number(senderId)) || [];
        queued.push(candidate);
        groupCandidatesRef.current.set(Number(senderId), queued);
      }
    };

    const onGroupParticipantLeft = ({ callId, participantId }) => {
      if (callRef.current?.callId !== callId) return;
      groupPeersRef.current.get(Number(participantId))?.close();
      groupPeersRef.current.delete(Number(participantId));
      groupCandidatesRef.current.delete(Number(participantId));
      setRemotePeers((current) =>
        current.filter((item) => !sameId(item.peer.id, participantId)),
      );
      callRef.current = {
        ...callRef.current,
        participants: (callRef.current.participants || []).filter(
          (item) => !sameId(item.id, participantId),
        ),
      };
      setCall(callRef.current);
    };

    const onGroupEnded = ({ callId }) => {
      if (callRef.current?.callId === callId) {
        setIncoming(null);
        incomingRef.current = null;
        closeCall();
      } else if (incomingRef.current?.callId === callId) {
        setIncoming(null);
        incomingRef.current = null;
      }
    };

    // NEW: the other user's device received the call
    const onCallRinging = () => {
      setCall((c) =>
        c && c.status === "calling" ? { ...c, status: "ringing" } : c,
      );
    };

    const onCallAccepted = async ({ answer }) => {
      await peerRef.current?.setRemoteDescription(answer);
      await flushCandidates();
      setCall((c) => (c ? { ...c, status: "connecting" } : c));
    };

    const onIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      const pc = peerRef.current;
      if (pc?.remoteDescription) await pc.addIceCandidate(candidate);
      else pendingRef.current.push(candidate);
    };

    const onStopped = () => {
      setIncoming(null);
      incomingRef.current = null;
      closeCall();
    };

    return listen({
      incomingCall: onIncoming,
      groupCallIncoming: onGroupIncoming,
      groupCallStarted: onGroupStarted,
      groupCallJoined: onGroupJoined,
      groupParticipantJoined: onGroupParticipantJoined,
      groupCallOffer: onGroupOffer,
      groupCallAnswer: onGroupAnswer,
      groupCallIceCandidate: onGroupIceCandidate,
      groupParticipantLeft: onGroupParticipantLeft,
      groupCallEnded: onGroupEnded,
      groupCallError: ({ error: message }) => {
        closeCall();
        setIncoming(null);
        incomingRef.current = null;
        setError(message);
      },
      callRinging: onCallRinging, // NEW
      callAccepted: onCallAccepted,
      iceCandidate: onIceCandidate,
      callEnded: onStopped,
      callRejected: onStopped,
    });
  }, []);

  // call timer
  const connected = call?.status === "connected";
  useEffect(() => {
    if (!connected) return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

  // hide error message after a few seconds
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(id);
  }, [error]);

  // release camera / mic if the component goes away
  useEffect(
    () => () => {
      if (callRef.current?.group) {
        socket.emit("groupCallLeave", { callId: callRef.current.callId });
      }
      peerRef.current?.close();
      groupPeersRef.current.forEach((connection) => connection.close());
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return {
    incoming,
    call,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    seconds,
    error,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    remotePeers,
  };
}