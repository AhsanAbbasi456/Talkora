export const createPeerConnection = (onIceCandidate, onRemoteStream) => {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  peer.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate);
  };

  peer.ontrack = (event) => onRemoteStream(event.streams[0]);

  return peer;
};