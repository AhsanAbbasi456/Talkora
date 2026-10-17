import {
  Ban,
  ChevronDown,
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");

const fmtDuration = (s = 0) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

// what to show for each call result, from the point of view of the viewer
function describe(message, isOwn) {
  const isVideo = message.fileName === "video";
  const kind = isVideo ? "video call" : "voice call";
  const Title = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  switch (message.body) {
    case "completed":
      return {
        title: Title(kind),
        sub: fmtDuration(message.duration),
        Icon: isOwn ? PhoneOutgoing : PhoneIncoming,
        missed: false,
      };
    case "declined":
      return {
        title: Title(kind),
        sub: isOwn ? "Declined" : "You declined",
        Icon: isOwn ? PhoneOutgoing : PhoneIncoming,
        missed: false,
      };
    default: // missed or cancelled
      return isOwn
        ? {
            title: Title(kind),
            sub: message.body === "missed" ? "No answer" : "Cancelled",
            Icon: PhoneOutgoing,
            missed: false,
          }
        : {
            title: `Missed ${kind}`,
            sub: "Tap call to call back",
            Icon: PhoneMissed,
            missed: true,
          };
  }
}

export default function CallLogBubble({
  message,
  isOwn,
  menuUp = false,
  onDelete,
  onUndo,
  canUndo,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const optionsRef = useRef(null);
  const isDeleted =
    message.deletedForEveryone || message.deletedForMeLocally;

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenu = (event) => {
      if (
        !menuRef.current?.contains(event.target) &&
        !optionsRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [menuOpen]);

  const menuAction = (action) => {
    setMenuOpen(false);
    action?.();
  };

  if (isDeleted) {
    return (
      <div className={`flex my-1 ${isOwn ? "justify-end" : "justify-start"}`}>
        <div className="group relative flex items-center gap-2 rounded-lg border border-(--border) bg-(--panel-bg) px-2.5 py-1.5 text-[13.5px] italic text-(--text-muted)">
          <Ban size={14} />
          <span>
            {message.deletedForMeLocally || isOwn
              ? "You deleted this call log"
              : "This call log was deleted"}
          </span>
          {canUndo && (
            <button
              ref={optionsRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Call log options"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <ChevronDown size={14} />
            </button>
          )}
          {menuOpen && canUndo && (
            <div
              ref={menuRef}
              className={`absolute z-30 w-40 rounded-lg border border-(--border) bg-(--panel-bg) p-1.5 shadow-xl not-italic ${
                isOwn ? "right-0" : "left-0"
              } ${menuUp ? "bottom-full mb-1" : "top-full mt-1"}`}
            >
              <button
                type="button"
                onClick={() => menuAction(onUndo)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-(--text-primary) hover:bg-white/5"
              >
                <span className="text-base leading-none">↶</span>
                Undo delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { title, sub, Icon, missed } = describe(message, isOwn);
  const TypeIcon = message.fileName === "video" ? Video : Phone;

  return (
    <div className={`flex my-1 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className="group relative flex items-center gap-3 min-w-[210px] max-w-[80%] rounded-2xl border border-(--border) bg-(--panel-bg) px-3 py-2.5">
        <button
          ref={optionsRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Call log options"
          className="absolute right-1 top-1 rounded-full bg-black/30 p-1 text-(--text-primary) opacity-0 transition hover:bg-black/50 group-hover:opacity-100 focus:opacity-100"
        >
          <ChevronDown size={14} />
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            className={`absolute z-30 w-40 rounded-lg border border-(--border) bg-(--panel-bg) p-1.5 shadow-xl ${
              isOwn ? "right-0" : "left-0"
            } ${menuUp ? "bottom-full mb-1" : "top-full mt-1"}`}
          >
            <button
              type="button"
              onClick={() => menuAction(onDelete)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-red-400 hover:bg-white/5"
            >
              <Trash2 size={16} />
              Delete call log
            </button>
          </div>
        )}
        <span
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            missed ? "bg-[#d93a35]/15 text-[#ff6b66]" : "bg-[#25d366]/15 text-[#25d366]"
          }`}
        >
          <TypeIcon size={18} />
        </span>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              missed ? "text-[#ff6b66]" : "text-(--text-primary)"
            }`}
          >
            {title}
          </p>
          <p className="flex items-center gap-1 text-xs text-(--text-muted) tabular-nums">
            <Icon size={13} className={missed ? "text-[#ff6b66]" : ""} />
            {sub}
          </p>
        </div>

        <span className="text-[11px] text-(--text-muted) self-end shrink-0">
          {format(new Date(message.createdAt), "h:mm a")}
        </span>
      </div>
    </div>
  );
}