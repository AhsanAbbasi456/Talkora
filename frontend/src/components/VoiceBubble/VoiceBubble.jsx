import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Play, Pause, Mic } from "lucide-react";
import { formatDuration } from "../VoiceRecorder/VoiceRecorder";
import { getAvatarColor } from "../../utils/avatarColor";

// Same message id -> same bar heights every time
const makeBars = (seed, count = 36) =>
  Array.from({ length: count }, (_, i) =>
    Math.round(5 + Math.abs(Math.sin(seed * 9.1 + i * 1.7) * Math.cos(i * 0.6 + seed)) * 19)
  );

export default function VoiceBubble({ message, src, isOwn }) {
  const { user } = useSelector((state) => state.auth);
  const audioRef = useRef(null);
  const playedBarsRef = useRef(null);
  const progressDotRef = useRef(null);
  const speedRef = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const playbackSpeeds = [1, 1.5, 2];
  const playbackSpeed = playbackSpeeds[speedIndex];

  const duration = message.duration || 0;
  const bars = useMemo(() => makeBars(Number(message.id) || 1), [message.id]);

  const avatarUrl = isOwn ? user?.avatarUrl : message.senderAvatarUrl;
  const name = isOwn ? user?.name : message.senderName;

  const paintProgress = useCallback((currentTime) => {
    const audioDuration = audioRef.current?.duration;
    const totalDuration =
      Number.isFinite(audioDuration) && audioDuration > 0
        ? audioDuration
        : duration;
    const percent = totalDuration
      ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100))
      : 0;

    if (playedBarsRef.current) {
      playedBarsRef.current.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
    }
    if (progressDotRef.current) {
      progressDotRef.current.style.left = `${percent}%`;
    }
  }, [duration]);

  useEffect(() => {
    const audio = new Audio(src);
    audio.playbackRate = speedRef.current;
    audioRef.current = audio;

    audio.ontimeupdate = () => setTime(audio.currentTime);
    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onloadedmetadata = () => paintProgress(audio.currentTime);
    audio.onended = () => {
      setPlaying(false);
      setTime(0);
      speedRef.current = 1;
      setSpeedIndex(0);
      paintProgress(0);
    };

    paintProgress(0);
    return () => {
      audio.pause();
      audio.ontimeupdate = null;
      audio.onplay = null;
      audio.onpause = null;
      audio.onloadedmetadata = null;
      audio.onended = null;
    };
  }, [paintProgress, src]);

  useEffect(() => {
    if (!playing) return;

    let frameId;
    const update = () => {
      const audio = audioRef.current;
      if (!audio) return;
      paintProgress(audio.currentTime);
      if (!audio.paused && !audio.ended) {
        frameId = requestAnimationFrame(update);
      }
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [paintProgress, playing]);

  const cyclePlaybackSpeed = () => {
    const nextIndex = (speedIndex + 1) % playbackSpeeds.length;
    const nextSpeed = playbackSpeeds[nextIndex];
    speedRef.current = nextSpeed;
    setSpeedIndex(nextIndex);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (audio.paused) {
      if (audio.ended) {
        audio.currentTime = 0;
        setTime(0);
        paintProgress(0);
        speedRef.current = 1;
        setSpeedIndex(0);
        audio.playbackRate = 1;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  // click on the waveform to jump to that point
  const seek = (e) => {
    if (!duration) return;
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    audioRef.current.currentTime = ratio * duration;
    setTime(ratio * duration);
    paintProgress(ratio * duration);
  };

  const playedColor = isOwn ? "bg-white" : "bg-(--accent)";
  const idleColor = isOwn ? "bg-white/40" : "bg-(--text-muted)/50";

  return (
    <div className="flex min-w-52 sm:min-w-64 items-center gap-3 py-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="shrink-0 transition hover:scale-110"
      >
        {playing ? (
          <Pause size={24} fill="currentColor" />
        ) : (
          <Play size={24} fill="currentColor" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          onClick={seek}
          className="relative flex h-7 cursor-pointer items-center gap-[2px]"
        >
          {bars.map((height, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full ${idleColor}`}
              style={{ height }}
            />
          ))}

          <div
            ref={playedBarsRef}
            className="pointer-events-none absolute inset-0 flex items-center gap-[2px]"
            style={{ clipPath: "inset(0 100% 0 0)" }}
          >
            {bars.map((height, i) => (
              <span
                key={i}
                className={`flex-1 rounded-full ${playedColor}`}
                style={{ height }}
              />
            ))}
          </div>

          <span
            ref={progressDotRef}
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${playedColor}`}
            style={{ left: "0%" }}
          />
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums opacity-80">
            {formatDuration(playing || time > 0 ? Math.floor(time) : duration)}
          </span>
        </div>
      </div>

      <div className="relative shrink-0">
        {playing ? (
          <button
            type="button"
            onClick={cyclePlaybackSpeed}
            aria-label={`Playback speed ${playbackSpeed} times; change speed`}
            title="Change playback speed"
            className="flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-current"
          >
            {playbackSpeed}×
          </button>
        ) : avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-[#F8FAFC]"
            style={{ backgroundColor: getAvatarColor(message.senderId) }}
          >
            {name?.[0]?.toUpperCase() || <Mic size={18} />}
          </div>
        )}

        {!playing && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-(--app-bg)">
            <Mic size={12} className="text-[#25D366]" />
          </span>
        )}
      </div>
    </div>
  );
}