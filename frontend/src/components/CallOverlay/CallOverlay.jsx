import { useRef, useEffect, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  Lock,
  MessageCircle,
  Minus,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { getAvatarColor } from "../../utils/avatarColor";

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const STATUS_TEXT = {
  calling: "Calling...",
  ringing: "Ringing...",
  connecting: "Connecting...",
};

// ---------- small pieces ----------

function Avatar({ peer, className }) {
  const initials =
    (peer.name || "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return peer.avatarUrl ? (
    <img
      src={peer.avatarUrl}
      alt={peer.name}
      className={`rounded-full object-cover ${className}`}
    />
  ) : (
    <div
      className={`rounded-full flex items-center justify-center font-semibold text-white ${className}`}
      style={{ backgroundColor: getAvatarColor(peer.id) }}
    >
      {initials}
    </div>
  );
}

// One component for all three sizes. It keeps the same elements in every mode,
// so the <video> tags are never remounted and the sound never cuts out.
function Shell({ view, wide, children }) {
  const minimized = view === "minimized";
  const maximized = view === "maximized";

  const outer = minimized
    ? "fixed bottom-20 right-4 z-50"
    : `fixed inset-0 z-50 flex items-center justify-center ${
        maximized ? "bg-[#0b141a]" : "bg-black/70 sm:p-4"
      }`;

  const inner = minimized
    ? "w-[300px] max-w-[calc(100vw-2rem)] rounded-xl border border-white/10"
    : maximized
      ? "w-full h-full"
      : `w-full h-full sm:h-[600px] sm:rounded-xl ${
          wide ? "sm:max-w-[880px]" : "sm:max-w-[420px]"
        }`;

  return (
    <div className={outer}>
      <div
        className={`relative flex flex-col overflow-hidden bg-[#0b141a] text-[#e9edef] shadow-2xl ${inner}`}
      >
        {children}
      </div>
    </div>
  );
}

function WinBtn({ onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 flex items-center justify-center rounded-md text-[#8696a0] hover:bg-white/10 hover:text-white transition focus-visible:outline-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}

function TopBar({
  view,
  overlay,
  sizeControls = true,
  closeLabel,
  onMinimize,
  onToggleMax,
  onClose,
}) {
  const maximized = view === "maximized";

  return (
    <div
      className={`relative z-10 flex items-center justify-between gap-2 pl-4 pr-2 py-2 text-xs text-[#8696a0] ${
        overlay ? "bg-black/40" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-6 h-6 rounded-full bg-[#25d366] flex items-center justify-center shrink-0">
          <MessageCircle size={14} className="text-[#06230f]" />
        </span>
        <span className="text-[#e9edef] font-medium text-sm">Talkora</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Lock size={12} />
        <span>End-to-end encrypted</span>
      </div>

      <div className="flex items-center shrink-0">
        {sizeControls && (
          <>
            <WinBtn label="Minimize" onClick={onMinimize}>
              <Minus size={16} />
            </WinBtn>
            <WinBtn
              label={maximized ? "Restore" : "Full screen"}
              onClick={onToggleMax}
            >
              {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </WinBtn>
          </>
        )}
        <WinBtn label={closeLabel} onClick={onClose}>
          <X size={17} />
        </WinBtn>
      </div>
    </div>
  );
}

function RoundBtn({ onClick, label, active, small, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${
        small ? "w-9 h-9" : "w-12 h-12"
      } rounded-full flex items-center justify-center shrink-0 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-white ${
        active
          ? "bg-white text-[#0b141a]"
          : "bg-[#202c33] text-[#e9edef] hover:bg-[#2a3942]"
      }`}
    >
      {children}
    </button>
  );
}

// red hang-up / decline button (phone turned face down, like WhatsApp)
function HangupBtn({ onClick, label, small }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${
        small ? "h-9 w-11" : "h-12 w-16 sm:w-20"
      } rounded-full bg-[#d93a35] hover:bg-[#e5504b] text-white flex items-center justify-center shrink-0 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-white`}
    >
      <Phone
        size={small ? 17 : 22}
        className="rotate-135"
        fill="currentColor"
      />
    </button>
  );
}

// avatar with the green ring that pulses while the phone is ringing
function PulseAvatar({ peer, pulse, large }) {
  return (
    <div className="relative mb-4">
      {pulse && (
        <span className="absolute inset-0 rounded-full bg-[#25d366]/25 animate-ping motion-reduce:animate-none" />
      )}
      <Avatar
        peer={peer}
        className={`relative ${
          large ? "w-36 h-36 text-4xl" : "w-28 h-28 text-3xl"
        }`}
      />
    </div>
  );
}

function StreamVideo({ stream, muted = false, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream || null;
    video.play?.().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}

function GroupParticipantTile({
  participant,
  stream,
  localStream,
  isSelf,
  isVideo,
  connected,
  cameraOff,
}) {
  const mediaStream = isSelf ? localStream : stream;
  const showVideo =
    isVideo && connected && mediaStream && !(isSelf && cameraOff);

  return (
    <div className="relative flex min-h-36 min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#17232b]">
      {showVideo ? (
        <StreamVideo
          stream={mediaStream}
          muted={isSelf}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Avatar
          peer={participant}
          className="relative h-20 w-20 text-2xl"
        />
      )}
      {!isVideo && stream && (
        <StreamVideo stream={stream} className="absolute h-px w-px opacity-0" />
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-5 text-sm font-medium">
        {isSelf ? "You" : participant.name}
      </span>
    </div>
  );
}

// the small floating card shown when the call is minimized
function MiniBar({ peer, text, muted, onRestore, onMute, onEnd }) {
  return (
    <div className="flex items-center gap-2 p-3">
      <button
        type="button"
        onClick={onRestore}
        aria-label="Open call"
        title="Open call"
        className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg focus-visible:outline-2 focus-visible:outline-white"
      >
        <Avatar peer={peer} className="w-10 h-10 text-sm shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm truncate">{peer.name}</span>
          <span className="block text-xs text-[#8696a0] tabular-nums">
            {text}
          </span>
        </span>
      </button>

      <RoundBtn
        small
        label={muted ? "Unmute" : "Mute"}
        active={muted}
        onClick={onMute}
      >
        {muted ? <MicOff size={17} /> : <Mic size={17} />}
      </RoundBtn>
      <HangupBtn small label="End call" onClick={onEnd} />
    </div>
  );
}

// ---------- main component ----------

export default function CallOverlay({
  incoming,
  call,
  remoteStream,
  muted,
  cameraOff,
  seconds,
  error,
  remotePeers = [],
  localStream,
  acceptCall,
  rejectCall,
  endCall,
  toggleMute,
  toggleCamera,
}) {
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const active = Boolean(call);

  // "normal" | "maximized" | "minimized"
  const [view, setView] = useState("normal");

  // every new call starts as a normal window
  useEffect(() => {
    if (!call && !incoming) setView("normal");
  }, [call, incoming]);

  const toggleMax = () =>
    setView((v) => (v === "maximized" ? "normal" : "maximized"));

  // the video elements only exist while a call is active, so re-attach when that changes
  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
  }, [localStream, active]);

  useEffect(() => {
    const el = remoteRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    el.play?.().catch(() => {});
  }, [remoteStream, active]);

  let screen = null;

  // ---------- ACTIVE CALL ----------
  if (call) {
    const isVideo = call.callType === "video";
    const connected = call.status === "connected";
    const minimized = view === "minimized";
    const showRemote = !call.group && isVideo && connected && remoteStream && !minimized;
    const showLocal = isVideo && !cameraOff && !minimized;
    const pulse = !connected;
    const statusText = connected
      ? fmt(seconds)
      : STATUS_TEXT[call.status] || "Calling...";

    const localClass = !showLocal
      ? "hidden"
      : connected
        ? "absolute right-4 bottom-28 z-20 w-28 sm:w-40 aspect-[3/4] rounded-xl object-cover border border-white/20 shadow-xl -scale-x-100"
        : "absolute inset-0 w-full h-full object-cover opacity-30 -scale-x-100";

    screen = (
      <Shell view={view} wide={(call.group || isVideo) && connected}>
        {/* remote video / audio (always mounted so sound keeps playing) */}
        {!call.group && (
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className={
              showRemote
                ? "absolute inset-0 w-full h-full object-cover"
                : "absolute w-px h-px opacity-0 pointer-events-none"
            }
          />
        )}

        {/* your own camera */}
        {!call.group && (
          <video ref={localRef} autoPlay playsInline muted className={localClass} />
        )}

        {minimized ? (
          <MiniBar
            peer={call.peer}
            text={statusText}
            muted={muted}
            onRestore={() => setView("normal")}
            onMute={toggleMute}
            onEnd={endCall}
          />
        ) : (
          <>
            <TopBar
              view={view}
              overlay={showRemote}
              closeLabel="End call"
              onMinimize={() => setView("minimized")}
              onToggleMax={toggleMax}
              onClose={endCall}
            />

            {call.group ? (
              <>
                <div className="relative z-10 flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{call.peer.name}</p>
                    <p className="text-xs text-white/65">
                      {call.participants?.length || 1} in call · {statusText}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/75">
                    {isVideo ? "Video call" : "Audio call"}
                  </span>
                </div>
                <div
                  className={`relative z-10 grid flex-1 content-center gap-3 overflow-y-auto px-4 pb-4 ${
                    isVideo
                      ? "grid-cols-1 sm:grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3"
                  }`}
                >
                  {(call.participants || []).map((participant) => {
                    const isSelf = Number(participant.id) === Number(call.selfId);
                    const remote = remotePeers.find(
                      (item) => Number(item.peer.id) === Number(participant.id),
                    );
                    return (
                      <GroupParticipantTile
                        key={participant.id}
                        participant={participant}
                        stream={remote?.stream}
                        localStream={localStream}
                        isSelf={isSelf}
                        isVideo={isVideo}
                        connected={connected}
                        cameraOff={cameraOff}
                      />
                    );
                  })}
                </div>
              </>
            ) : showRemote ? (
              <div className="relative z-10 text-center pt-2 pb-10 bg-gradient-to-b from-black/50 to-transparent">
                <p className="font-medium text-lg">{call.peer.name}</p>
                <p className="text-sm text-white/80 tabular-nums">
                  {fmt(seconds)}
                </p>
              </div>
            ) : (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
                <PulseAvatar
                  peer={call.peer}
                  pulse={pulse}
                  large={view === "maximized"}
                />
                <h2 className="text-2xl font-normal">{call.peer.name}</h2>
                <p className="mt-1 text-[15px] text-[#8696a0] tabular-nums">
                  {statusText}
                </p>
              </div>
            )}

            {showRemote && <div className="flex-1" />}

            {/* controls */}
            <div
              className={`relative z-10 flex items-center justify-center gap-3 px-4 pb-6 pt-6 ${
                showRemote ? "bg-gradient-to-t from-black/60 to-transparent" : ""
              }`}
            >
              {isVideo && (
                <RoundBtn
                  label={cameraOff ? "Turn camera on" : "Turn camera off"}
                  active={cameraOff}
                  onClick={toggleCamera}
                >
                  {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                </RoundBtn>
              )}
              <RoundBtn
                label={muted ? "Unmute" : "Mute"}
                active={muted}
                onClick={toggleMute}
              >
                {muted ? <MicOff size={22} /> : <Mic size={22} />}
              </RoundBtn>
              <HangupBtn label="End call" onClick={endCall} />
            </div>
          </>
        )}
      </Shell>
    );
  }

  // ---------- INCOMING CALL ----------
  else if (incoming) {
    const isVideo = incoming.callType === "video";
    const incomingPeer = incoming.groupCall ? incoming.caller : incoming.peer;

    screen = (
      <Shell view="normal">
        <TopBar
          view="normal"
          sizeControls={false}
          closeLabel="Decline"
          onClose={rejectCall}
        />

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <PulseAvatar peer={incomingPeer} pulse />
          <h2 className="text-2xl font-normal">
            {incoming.groupCall ? incoming.groupName : incoming.peer.name}
          </h2>
          <p className="mt-1 text-[15px] text-[#8696a0]">
            {incoming.groupCall
              ? `${incoming.caller.name} is calling the group`
              : isVideo
                ? "Video call"
                : "Voice call"}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 px-4 pb-6 pt-6">
          <button
            type="button"
            onClick={acceptCall}
            className="h-12 flex-1 max-w-[220px] rounded-full bg-[#25d366] hover:bg-[#2be373] text-[#07140c] font-semibold flex items-center justify-center gap-2 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
          >
            {isVideo ? (
              <Video size={20} fill="currentColor" />
            ) : (
              <Phone size={20} fill="currentColor" />
            )}
            Accept
          </button>
          <HangupBtn label="Decline" onClick={rejectCall} />
        </div>
      </Shell>
    );
  }

  return (
    <>
      {screen}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-[#d93a35] px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </>
  );
}