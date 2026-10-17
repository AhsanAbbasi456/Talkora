import { useEffect, useRef, useState } from "react";
import { Trash2, Send } from "lucide-react";

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

export const formatDuration = (s = 0) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function VoiceRecorder({ onSend, onCancel }) {
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef(null);
  const shouldSend = useRef(false);
  const callbacks = useRef({});
  callbacks.current = { onSend, onCancel };

  useEffect(() => {
    let stream, timer, ignore = false;
    const chunks = [];

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        stream = s;
        if (ignore) return stream.getTracks().forEach((t) => t.stop());

        const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
        const rec = new MediaRecorder(stream, mimeType && { mimeType });
        const startedAt = Date.now();
        recorder.current = rec;

        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

        rec.onstop = () => {
          clearInterval(timer);
          stream.getTracks().forEach((t) => t.stop()); // turns the mic off
          if (!shouldSend.current) return;

          const duration = Math.round((Date.now() - startedAt) / 1000);
          if (duration < 1) return callbacks.current.onCancel();

          const type = rec.mimeType.split(";")[0] || "audio/webm";
          const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          callbacks.current.onSend(new File(chunks, `voice-note.${ext}`, { type }), duration);
        };

        rec.start();
        timer = setInterval(
          () => setSeconds(Math.round((Date.now() - startedAt) / 1000)),
          500
        );
      })
      .catch(() => callbacks.current.onCancel("Microphone access was blocked"));

    return () => {
      ignore = true;
      shouldSend.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, []);

  const finish = () => {
    if (recorder.current?.state !== "recording") return;
    shouldSend.current = true;
    recorder.current.stop();
  };

  const cancel = () => {
    shouldSend.current = false;
    recorder.current?.stop();
    onCancel();
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Enter" || event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      finish();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex-1 flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={cancel}
        title="Cancel"
        className="text-gray-400 hover:text-red-400 transition shrink-0"
      >
        <Trash2 size={20} />
      </button>

      <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-(--input-bg) border border-(--border) rounded-3xl text-sm text-(--text-primary)">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="tabular-nums">{formatDuration(seconds)}</span>
        <span className="text-xs text-(--text-muted)">Recording...</span>
      </div>

      <button
        type="button"
        onClick={finish}
        title="Send voice note"
        className="w-10 h-10 rounded-full flex items-center justify-center bg-(--accent) text-[#F8FAFC] shrink-0 transition-transform hover:scale-105 active:scale-95"
      >
        <Send size={16} />
      </button>
    </div>
  );
}