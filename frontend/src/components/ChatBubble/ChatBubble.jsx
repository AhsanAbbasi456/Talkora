import { useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  ChevronDown,
  Copy,
  Trash2,
  Ban,
  Check,
  CheckCheck,
  FileText,
  Download,
  X,
  Languages,
  Camera,
  Video as VideoIcon,
  Mic,
} from "lucide-react";
import HighlightText from "../../utils/HighlightText";
import PollBubble from "../PollBubble/PollBubble";
import VoiceBubble from "../VoiceBubble/VoiceBubble"; // VOICE
import { api } from "../../utils/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

const formatSize = (bytes = 0) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;

const menuItem =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-(--text-primary) hover:bg-white/5";
const chevronBase =
  "flex h-5 w-5 items-center justify-center rounded-full transition focus:opacity-100 group-hover:opacity-100 max-md:opacity-70";

export default function ChatBubble({
  message,
  isOwn,
  isLastInGroup = true,
  menuUp = false,
  onDelete,
  onReply,
  onEdit,
  onUndo,
  searchQuery = "",
  isActiveMatch = false,
  deliveryState = "sent",
  currentUserId,
  onVote,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [translation, setTranslation] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const [viewer, setViewer] = useState(null); // { url, type } while the media is open
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewOnceError, setViewOnceError] = useState("");

  const { token } = useSelector((state) => state.auth);
  const menuRef = useRef(null);
  const chevronRef = useRef(null);

  // close the options menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    const onMouseDown = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        chevronRef.current &&
        !chevronRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  // close the photo viewer with Escape
  useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (e) => e.key === "Escape" && setLightboxOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const messageText = message.body || message.text || "";
  const fileSrc = message.fileUrl
    ? /^https?:\/\//i.test(message.fileUrl)
      ? message.fileUrl
      : `${API_URL}${message.fileUrl}`
    : null;
  const isFile = Boolean(fileSrc);
  const isPoll = message.messageType === "POLL" && Boolean(message.poll);

  const messageTime = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : message.time || "";

  const deletedForMe = message.deletedForMeLocally === true;
  const isDeleted = deletedForMe || message.deletedForEveryone === true;

  const rowClass = `flex ${isOwn ? "justify-end" : "justify-start"} ${isLastInGroup ? "mb-2" : "mb-0.5"}`;
  const menuPosition = `${menuUp ? "bottom-full mb-1" : "top-full mt-1"} ${isOwn ? "right-0" : "left-0"}`;

  // closes the menu, then runs the action
  const act = (fn) => () => {
    setMenuOpen(false);
    fn?.();
  };

  const openViewOnce = async () => {
    if (viewerLoading) return;
    setViewerLoading(true);
    setViewOnceError("");
    try {
      const res = await fetch(
        `${API_URL}/api/messages/${message.id}/view-once`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not open");
      }
      const blob = await res.blob();
      setViewer({
        url: URL.createObjectURL(blob),
        type: message.messageType,
      });
    } catch (error) {
      setViewOnceError(error.message || "Could not open");
    } finally {
      setViewerLoading(false);
    }
  };

  const closeViewer = useCallback(() => {
    setViewer(null);
  }, []);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (event) => event.key === "Escape" && closeViewer();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewer, closeViewer]);

  useEffect(() => {
    const url = viewer?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [viewer?.url]);

  // Translate: Urdu -> English, English -> Urdu (the backend decides)
  const handleTranslate = async () => {
    // tapping again hides the translation
    if (translation || translateError) {
      setTranslation("");
      setTranslateError("");
      return;
    }
    setTranslating(true);
    try {
      const data = await api("/ai/translate", token, "POST", {
        text: messageText,
      });
      setTranslation(data.translation || "");
    } catch {
      setTranslateError("Could not translate. Try again.");
    } finally {
      setTranslating(false);
    }
  };

  const optionsButton = (className) => (
    <button
      ref={chevronRef}
      type="button"
      onClick={() => setMenuOpen((v) => !v)}
      aria-label="Message options"
      className={`${chevronBase} ${className} ${menuOpen ? "opacity-100" : "opacity-0"}`}
    >
      <ChevronDown size={14} />
    </button>
  );

  // ==========================================
  // DELETED MESSAGE
  // ==========================================

  if (isDeleted) {
    return (
      <div className={rowClass}>
        <div className="group relative flex items-center gap-1.5 rounded-lg border border-(--border) bg-(--panel-bg) px-2.5 py-1.5 text-[13.5px] italic text-(--text-muted)">
          <Ban size={14} />
          <span>
            {deletedForMe || isOwn
              ? "You deleted this message"
              : "This message was deleted"}
          </span>

          {optionsButton(
            "ml-1 shrink-0 bg-black/30 text-(--text-primary) not-italic hover:bg-black/50",
          )}

          {menuOpen && (
            <div
              ref={menuRef}
              className={`absolute z-30 w-44 rounded-lg border border-(--border) bg-(--panel-bg) p-1.5 shadow-xl not-italic ${menuPosition}`}
            >
              <button type="button" onClick={act(onUndo)} className={menuItem}>
                <span className="text-base leading-none">↶</span>
                Undo message
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // NORMAL MESSAGE
  // ==========================================

  return (
    <div className={rowClass}>
      <div
        className={`group relative min-w-16 max-w-[75%] sm:max-w-[65%] px-2.5 py-1.5 text-[14.2px] leading-[1.35] rounded-lg ${
          isOwn
            ? `bg-[#075e54] text-[#F8FAFC] ${isLastInGroup ? "rounded-br-none" : ""}`
            : `bg-(--panel-bg) text-(--text-primary) border border-(--border) ${isLastInGroup ? "rounded-bl-none" : ""}`
        } ${isActiveMatch ? "ring-2 ring-orange-400" : ""}`}
      >
        {/* MESSAGE OPTIONS */}
        {optionsButton("absolute right-1 top-1 z-10 bg-black/40 text-white")}

        {menuOpen && (
          <div
            ref={menuRef}
            className={`absolute z-20 w-44 rounded-lg border border-(--border) bg-(--panel-bg) p-1.5 shadow-xl ${menuPosition}`}
          >
            {messageText && (
              <button
                type="button"
                onClick={act(() => navigator.clipboard.writeText(messageText))}
                className={menuItem}
              >
                <Copy size={16} />
                Copy
              </button>
            )}

            <button type="button" onClick={act(onReply)} className={menuItem}>
              <span className="text-base leading-none">↩</span>
              Reply
            </button>

            {/* Translate: text messages only */}
            {messageText && !isPoll && (
              <button
                type="button"
                onClick={act(handleTranslate)}
                className={menuItem}
              >
                <Languages size={16} />
                {translation || translateError
                  ? "Hide translation"
                  : "Translate"}
              </button>
            )}

            {/* Editing is for text messages only */}
            {isOwn && !isFile && !isPoll && !message.viewOnce && (
              <button type="button" onClick={act(onEdit)} className={menuItem}>
                <span className="text-base leading-none">✎</span>
                Edit
              </button>
            )}

            <button
              type="button"
              onClick={act(onDelete)}
              className={`${menuItem} text-red-400`}
            >
              <Trash2 size={16} />
              Delete message
            </button>
          </div>
        )}

        {/* REPLY PREVIEW */}
        {message.replyToText && (
          <div className="mb-2 rounded-md border-l-2 border-(--accent) bg-black/10 px-2 py-1.5 text-[11px] text-(--text-muted)">
            <div className="font-medium text-[10px] uppercase tracking-[0.08em] text-(--text-muted)">
              Reply
            </div>
            <div className="mt-0.5 truncate text-(--text-primary)">
              {message.replyToText}
            </div>
          </div>
        )}
        {/* VIEW ONCE PLACEHOLDER */}
        {message.viewOnce &&
          (() => {
            const state = message.viewOnceState;
            const isVideo = message.messageType === "VIDEO";
            const isAudio = message.messageType === "AUDIO";
            const Icon = isVideo ? VideoIcon : isAudio ? Mic : Camera;
            const label = isVideo ? "Video" : isAudio ? "Voice message" : "Photo";
            const canOpen = !isOwn && state === "UNOPENED";
            const opened = state === "OPENED" || state === "EXPIRED";

            return (
              <button
                type="button"
                disabled={!canOpen || viewerLoading}
                onClick={openViewOnce}
                className={`mb-1 flex items-center gap-2.5 rounded-md bg-black/15 px-3 py-2.5 text-[13.5px] transition ${
                  canOpen
                    ? "cursor-pointer hover:bg-black/25"
                    : "cursor-default opacity-70"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-current text-[11px] font-bold">
                  1
                </span>
                <Icon size={16} />
                <span>
                  {viewerLoading
                    ? "Opening..."
                    : opened
                      ? "Opened"
                      : state === "SENT"
                        ? `${label} · Sent`
                      : canOpen
                        ? `${label} · Tap to open`
                        : label}
                </span>
              </button>
            );
          })()}
        {viewOnceError && (
          <p className="mb-1 text-[11px] text-red-400">{viewOnceError}</p>
        )}
        {/* FILE: PHOTO / VIDEO / VOICE NOTE / DOCUMENT */}
        {message.messageType === "IMAGE" && fileSrc && (
          <img
            src={fileSrc}
            alt={message.fileName || "Photo"}
            loading="lazy"
            onClick={() => setLightboxOpen(true)}
            className="mb-1 max-h-72 w-full max-w-65 cursor-zoom-in rounded-md object-cover"
          />
        )}

        {message.messageType === "VIDEO" && fileSrc && (
          <video
            src={fileSrc}
            controls
            preload="metadata"
            className="mb-1 max-h-72 w-full max-w-70 rounded-md bg-black"
          />
        )}

        {/* VOICE */}
        {message.messageType === "AUDIO" && fileSrc && (
          <VoiceBubble message={message} src={fileSrc} isOwn={isOwn} />
        )}

        {message.messageType === "DOCUMENT" && fileSrc && (
          <a
            href={fileSrc}
            target="_blank"
            rel="noreferrer"
            download={message.fileName}
            className="mb-1 flex items-center gap-3 rounded-md bg-black/15 px-3 py-2.5 hover:bg-black/25 transition"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/20">
              <FileText size={20} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {message.fileName || "Document"}
              </span>
              <span className="block text-[11px] opacity-70">
                {formatSize(message.fileSize)}
              </span>
            </span>

            <Download size={18} className="shrink-0 opacity-80" />
          </a>
        )}

        {/* POLL */}
        {isPoll && (
          <PollBubble
            poll={message.poll}
            isOwn={isOwn}
            currentUserId={currentUserId}
            onVote={onVote}
          />
        )}

        {/* MESSAGE TEXT (or caption). A poll already shows its question. */}
        {messageText && !isPoll && (
          <p className="whitespace-pre-wrap break-words">
            <HighlightText
              text={messageText}
              query={searchQuery}
              active={isActiveMatch}
            />
          </p>
        )}

        {/* TRANSLATION */}
        {(translating || translation || translateError) && (
          <div
            className={`mt-1.5 border-t border-white/10 pt-1.5 text-[13px] italic whitespace-pre-wrap break-words ${
              translateError ? "text-red-400" : "opacity-90"
            }`}
          >
            {translating ? "Translating..." : translateError || translation}
          </div>
        )}

        {message.editedAt && (
          <span className="mt-1 block text-[9px] italic text-(--text-muted)/80">
            edited
          </span>
        )}

        {/* TIME + DELIVERY STATUS */}
        <span
          className={`flex items-center justify-end gap-1.5 text-[10px] leading-none mt-1 ${
            isOwn ? "text-indigo-100" : "text-(--text-muted)"
          }`}
        >
          {messageTime}

          {isOwn &&
            (deliveryState === "read" ? (
              <CheckCheck
                size={18}
                className="text-[#53c8f5] drop-shadow-[0_0_4px_rgba(83,200,245,0.8)]"
                strokeWidth={3}
                aria-label="Read"
                title="Read"
              />
            ) : deliveryState === "delivered" ? (
              <CheckCheck
                size={17}
                className="text-[#cbd5e1]"
                strokeWidth={2.6}
                aria-label="Delivered"
                title="Delivered"
              />
            ) : (
              <Check
                size={17}
                className="text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.75)]"
                strokeWidth={3}
                aria-label="Sent"
                title="Sent"
              />
            ))}
        </span>
      </div>

      {/* PHOTO VIEWER */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close photo"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X size={22} />
          </button>

          <img
            src={fileSrc}
            alt={message.fileName || "Photo"}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-md object-contain"
          />
        </div>
      )}

      {viewer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="View-once media"
          onClick={closeViewer}
          onContextMenu={(event) => event.preventDefault()}
          className="fixed inset-0 z-50 flex select-none items-center justify-center bg-black/95 p-4"
        >
          <button
            type="button"
            onClick={closeViewer}
            aria-label="Close view-once media"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X size={22} />
          </button>
          <p className="absolute left-4 top-4 text-xs text-white/70">
            View once · close to finish viewing
          </p>

          {viewer.type === "VIDEO" ? (
            <video
              src={viewer.url}
              controls
              autoPlay
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full rounded-md"
            />
          ) : viewer.type === "AUDIO" ? (
            <div
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/15 bg-white/10 p-6 text-center text-white"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
                <Mic size={28} />
              </div>
                <p className="mb-4 text-sm font-medium">View-once voice message</p>
                <audio
                  src={viewer.url}
                  controls
                  controlsList="nodownload noplaybackrate"
                  onContextMenu={(event) => event.preventDefault()}
                  className="w-full"
              />
            </div>
          ) : (
            <img
              src={viewer.url}
              alt="View-once photo"
              draggable={false}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full rounded-md object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
}
