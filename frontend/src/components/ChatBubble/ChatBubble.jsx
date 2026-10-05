import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Copy,
  Trash2,
  Ban,
  Check,
  CheckCheck,
} from "lucide-react";
import HighlightText from "../../utils/HighlightText";

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
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);
  const chevronRef = useRef(null);

  // ==========================================
  // CLOSE MENU WHEN CLICKING OUTSIDE
  // ==========================================

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        chevronRef.current &&
        !chevronRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, [menuOpen]);

  const messageText =
    message.body || message.text || "";

  const messageTime = message.createdAt
    ? new Date(
        message.createdAt,
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : message.time || "";

  // ==========================================
  // MESSAGE DELETED FOR ME
  // ==========================================

  const deletedForMe =
    message.deletedForMeLocally === true;

  // ==========================================
  // MESSAGE DELETED FOR EVERYONE
  // ==========================================

  const deletedForEveryone =
    message.deletedForEveryone === true;

  const isDeleted =
    deletedForMe || deletedForEveryone;

  // ==========================================
  // DELETED MESSAGE
  // ==========================================

  if (isDeleted) {
    return (
      <div
        className={`flex ${
          isOwn
            ? "justify-end"
            : "justify-start"
        } ${
          isLastInGroup
            ? "mb-2"
            : "mb-0.5"
        }`}
      >
        <div
          className="group relative flex items-center gap-1.5 rounded-lg border border-(--border) bg-(--panel-bg) px-2.5 py-1.5 text-[13.5px] italic text-(--text-muted)"
        >
          {/* Deleted message text */}

          <Ban size={14} />

          <span>
            {deletedForMe
              ? "You deleted this message"
              : isOwn
                ? "You deleted this message"
                : "This message was deleted"}
          </span>

          {/* ======================================
              ARROW BUTTON
          ====================================== */}

          <button
            ref={chevronRef}
            type="button"
            onClick={() =>
              setMenuOpen(
                (value) => !value,
              )
            }
            aria-label="Message options"
            className={`ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/30 text-(--text-primary) not-italic transition hover:bg-black/50 focus:opacity-100 group-hover:opacity-100 max-md:opacity-70 ${
              menuOpen
                ? "opacity-100"
                : "opacity-0"
            }`}
          >
            <ChevronDown size={14} />
          </button>

          {/* ======================================
              DELETED MESSAGE MENU
          ====================================== */}

          {menuOpen && (
            <div
              ref={menuRef}
              className={`absolute z-30 w-44 rounded-lg border border-(--border) bg-(--panel-bg) p-1.5 shadow-xl not-italic ${
                menuUp
                  ? "bottom-full mb-1"
                  : "top-full mt-1"
              } ${
                isOwn
                  ? "right-0"
                  : "left-0"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onUndo?.();
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-(--text-primary) hover:bg-white/5"
              >
                <span className="text-base leading-none">
                  ↶
                </span>

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
    <div
      className={`flex ${
        isOwn
          ? "justify-end"
          : "justify-start"
      } ${
        isLastInGroup
          ? "mb-2"
          : "mb-0.5"
      }`}
    >
      <div
        className={`group relative min-w-16 max-w-[75%] sm:max-w-[65%] px-2.5 py-1.5 text-[14.2px] leading-[1.35] rounded-lg ${
          isOwn
            ? `bg-(--accent) text-[#F8FAFC] ${
                isLastInGroup
                  ? "rounded-br-none"
                  : ""
              }`
            : `bg-(--panel-bg) text-(--text-primary) border border-(--border) ${
                isLastInGroup
                  ? "rounded-bl-none"
                  : ""
              }`
        } ${
          isActiveMatch
            ? "ring-2 ring-orange-400"
            : ""
        }`}
      >
        {/* ======================================
            ARROW BUTTON
        ====================================== */}

        <button
          ref={chevronRef}
          type="button"
          onClick={() =>
            setMenuOpen(
              (value) => !value,
            )
          }
          aria-label="Message options"
          className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white transition focus:opacity-100 group-hover:opacity-100 max-md:opacity-70 ${
            menuOpen
              ? "opacity-100"
              : "opacity-0"
          }`}
        >
          <ChevronDown size={14} />
        </button>

        {/* ======================================
            NORMAL MESSAGE MENU
        ====================================== */}

        {menuOpen && (
          <div
            ref={menuRef}
            className={`absolute z-20 w-44 rounded-lg border border-(--border) bg-(--panel-bg) p-1.5 shadow-xl ${
              menuUp
                ? "bottom-full mb-1"
                : "top-full mt-1"
            } ${
              isOwn
                ? "right-0"
                : "left-0"
            }`}
          >
            {/* COPY */}

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  messageText,
                );

                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-(--text-primary) hover:bg-white/5"
            >
              <Copy size={16} />

              Copy
            </button>

            {/* REPLY */}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onReply?.();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-(--text-primary) hover:bg-white/5"
            >
              <span className="text-base leading-none">
                ↩
              </span>

              Reply
            </button>

            {/* EDIT */}

            {isOwn && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit?.();
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-(--text-primary) hover:bg-white/5"
              >
                <span className="text-base leading-none">
                  ✎
                </span>

                Edit
              </button>
            )}

            {/* DELETE */}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete?.();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-red-400 hover:bg-white/5"
            >
              <Trash2 size={16} />

              Delete message
            </button>
          </div>
        )}

        {/* ======================================
            REPLY PREVIEW
        ====================================== */}

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

        {/* ======================================
            MESSAGE TEXT
        ====================================== */}

        <p className="whitespace-pre-wrap break-words">
          <HighlightText
            text={messageText}
            query={searchQuery}
            active={isActiveMatch}
          />
        </p>

        {/* ======================================
            EDITED
        ====================================== */}

        {message.editedAt && (
          <span className="mt-1 block text-[9px] italic text-(--text-muted)/80">
            edited
          </span>
        )}

        {/* ======================================
            DELIVERY / READ STATUS
        ====================================== */}

        <span
          className={`flex items-center justify-end gap-1.5 text-[10px] leading-none mt-1 ${
            isOwn
              ? "text-indigo-100"
              : "text-(--text-muted)"
          }`}
        >
          {messageTime}

          {isOwn &&
            (deliveryState ===
            "read" ? (
              <CheckCheck
                size={14}
                className="text-sky-700 drop-shadow-[0_0_2px_rgba(2,132,199,0.5)]"
                strokeWidth={2.7}
              />
            ) : deliveryState ===
              "delivered" ? (
              <CheckCheck
                size={14}
                className="text-slate-900"
                strokeWidth={2.3}
              />
            ) : (
              <Check
                size={14}
                className="text-slate-900"
                strokeWidth={2.4}
              />
            ))}
        </span>
      </div>
    </div>
  );
}