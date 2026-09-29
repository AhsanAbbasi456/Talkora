import {
  Send,
  Paperclip,
  Smile,
  Phone,
  Video,
  MessageCircle,
  Info,
  ArrowLeft,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import ChatBubble from "../ChatBubble/ChatBubble";
import EmojiPicker from "../EmojiPicker/EmojiPicker";
import AttachmentMenu from "../AttachmentMenu/AttachmentMenu";
import { getAvatarColor } from "../../utils/avatarColor";

const API_BASE_URL = "http://localhost:3000/api";

export default function ChatWindow({
  activeChat,
  onSend,
  onShowDetails,
  onBack,
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const pickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const attachRef = useRef(null);
  const attachButtonRef = useRef(null);

  const { token, user } = useSelector((state) => state.auth);

  // ==========================================
  // GET MESSAGES
  // ==========================================

  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      if (!activeChat?.id || !token) {
        if (isMounted) {
          setMessages([]);
        }

        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/messages/${activeChat.id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error("Failed to fetch messages:", data);
          return;
        }

        if (isMounted) {
          setMessages(data.messages || []);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Get messages error:", error);
        }
      }
    };

    // Fetch immediately when chat opens
    fetchMessages();

    // ==========================================
    // CHECK FOR NEW MESSAGES EVERY 1 SECOND
    // ==========================================

    const intervalId = setInterval(() => {
      fetchMessages();
    }, 1000);

    // ==========================================
    // CLEANUP
    // ==========================================

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [activeChat?.id, token]);

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  const handleSend = async (e) => {
    e.preventDefault();

    const text = input.trim();

    if (!text || sending) {
      return;
    }

    try {
      setSending(true);

      // Send message to backend
      const savedMessage = await onSend(text);

      if (!savedMessage) {
        console.error("Message was not saved.");
        return;
      }

      // ==========================================
      // SHOW MESSAGE IMMEDIATELY
      // ==========================================

      setMessages((prevMessages) => {
        const alreadyExists = prevMessages.some(
          (message) => message.id === savedMessage.id
        );

        if (alreadyExists) {
          return prevMessages;
        }

        return [...prevMessages, savedMessage];
      });

      // Clear input
      setInput("");

      // Close emoji picker
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setSending(false);
    }
  };

  // ==========================================
  // ATTACH FILES
  // ==========================================

  const handleAttachFiles = (type, files) => {
    console.log("Selected via", type, files);
    setShowAttachMenu(false);
  };

  // ==========================================
  // ATTACH ACTION
  // ==========================================

  const handleAttachAction = (actionId) => {
    console.log("Attachment action:", actionId);
    setShowAttachMenu(false);
  };

  // ==========================================
  // CLOSE PICKERS WHEN CLICKING OUTSIDE
  // ==========================================

  useEffect(() => {
    if (!showEmojiPicker && !showAttachMenu) {
      return;
    }

    const handleClickOutside = (e) => {
      if (
        showEmojiPicker &&
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }

      if (
        showAttachMenu &&
        attachRef.current &&
        !attachRef.current.contains(e.target) &&
        attachButtonRef.current &&
        !attachButtonRef.current.contains(e.target)
      ) {
        setShowAttachMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [showEmojiPicker, showAttachMenu]);

  // ==========================================
  // NO ACTIVE CHAT
  // ==========================================

  if (!activeChat) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-(--app-bg) min-w-0 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-(--panel-bg) border border-(--border) flex items-center justify-center mb-4">
          <MessageCircle
            className="text-(--accent)"
            size={28}
          />
        </div>

        <h2 className="text-(--text-primary) font-semibold text-lg">
          Welcome to Talkora
        </h2>

        <p className="text-(--text-muted) text-sm mt-1">
          Choose a chat to start a conversation
        </p>
      </div>
    );
  }

  // ==========================================
  // USER INITIALS
  // ==========================================

  const userInitials =
    activeChat.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  // ==========================================
  // USER ABOUT
  // ==========================================

  const userAbout =
    activeChat.about ||
    "Hey there! I am using Talkora.";

  return (
    <div className="flex-1 flex flex-col bg-(--app-bg) min-w-0">
      {/* ==========================================
          CHAT HEADER
      ========================================== */}

      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-(--border) bg-(--panel-bg)">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Back button */}

          <button
            type="button"
            onClick={onBack}
            className="md:hidden rounded-lg p-1 -ml-1 text-gray-400 hover:text-white transition shrink-0"
            title="Back to chats"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Avatar */}

          {activeChat.avatarUrl ? (
            <img
              src={activeChat.avatarUrl}
              alt={activeChat.name}
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-(--border)"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm shrink-0"
              style={{
                backgroundColor: getAvatarColor(activeChat.id),
              }}
            >
              {userInitials}
            </div>
          )}

          {/* ==========================================
              USER NAME + ABOUT
          ========================================== */}

          <div className="min-w-0">
            <p className="text-(--text-primary) font-medium text-sm truncate">
              {activeChat.name}
            </p>

            <p className="text-xs text-(--text-muted) truncate">
              {userAbout}
            </p>
          </div>
        </div>

        {/* ==========================================
            HEADER BUTTONS
        ========================================== */}

        <div className="flex items-center gap-3 sm:gap-4 text-gray-400 shrink-0">
          {/* Phone */}

          <div className="relative group hidden sm:block">
            <button
              type="button"
              aria-label="Audio call"
              className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition"
              title="Coming soon"
            >
              <Phone size={18} />
            </button>

            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 z-20">
              Coming soon
            </span>
          </div>

          {/* Video */}

          <div className="relative group hidden sm:block">
            <button
              type="button"
              aria-label="Video call"
              className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition"
              title="Coming soon"
            >
              <Video size={18} />
            </button>

            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 z-20">
              Coming soon
            </span>
          </div>

          {/* Details */}

          <button
            type="button"
            onClick={onShowDetails}
            className="rounded-lg p-1 hover:bg-[#334155] hover:text-white transition"
            title="View chat details"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* ==========================================
          MESSAGES
      ========================================== */}

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4">
        {messages.length > 0 ? (
          messages.map((message) => {
            const isOwn =
              Number(message.senderId) === Number(user?.id);

            return (
              <ChatBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                avatarColor={getAvatarColor(activeChat.id)}
                name={activeChat.name}
              />
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-(--panel-bg) border border-(--border) flex items-center justify-center mb-3">
              <MessageCircle
                className="text-(--accent)"
                size={24}
              />
            </div>

            <p className="text-(--text-primary) text-sm font-medium">
              No messages yet
            </p>

            <p className="text-(--text-muted) text-xs mt-1">
              Start a conversation with {activeChat.name}
            </p>
          </div>
        )}
      </div>

      {/* ==========================================
          MESSAGE INPUT
      ========================================== */}

      <form
        onSubmit={handleSend}
        className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-t border-(--border) bg-(--panel-bg)"
      >
        {/* Attachment */}

        <button
          ref={attachButtonRef}
          type="button"
          onClick={() =>
            setShowAttachMenu((v) => !v)
          }
          className={`hidden sm:flex items-center justify-center text-gray-400 hover:text-white transition shrink-0 ${
            showAttachMenu ? "text-(--accent)" : ""
          }`}
          title="Attach"
        >
          <Paperclip size={20} />
        </button>

        {showAttachMenu && (
          <div
            ref={attachRef}
            className="absolute bottom-full left-3 mb-2 z-30"
          >
            <AttachmentMenu
              onSelectFiles={handleAttachFiles}
              onAction={handleAttachAction}
            />
          </div>
        )}

        {/* Emoji */}

        <button
          ref={emojiButtonRef}
          type="button"
          onClick={() =>
            setShowEmojiPicker((v) => !v)
          }
          className={`hidden sm:flex items-center justify-center text-gray-400 hover:text-white transition shrink-0 ${
            showEmojiPicker ? "text-(--accent)" : ""
          }`}
          title="Insert emoji"
        >
          <Smile size={20} />
        </button>

        {showEmojiPicker && (
          <div
            ref={pickerRef}
            className="absolute bottom-full left-3 sm:left-16 mb-2 z-30"
          >
            <EmojiPicker
              onSelect={(emoji) =>
                setInput((prev) => prev + emoji)
              }
            />
          </div>
        )}

        {/* Input */}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${activeChat.name}...`}
          disabled={sending}
          className="flex-1 px-4 py-2.5 bg-(--input-bg) border border-(--border) rounded-full text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent disabled:opacity-60"
        />

        {/* Send */}

        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-(--accent) text-[#F8FAFC] shrink-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}