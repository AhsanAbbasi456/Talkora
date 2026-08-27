import {
  Send,
  Paperclip,
  Smile,
  Phone,
  Video,
  MoreVertical,
  MessageCircle,
  Info,
  ArrowLeft,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ChatBubble from "../ChatBubble/ChatBubble";
import EmojiPicker from "../EmojiPicker/EmojiPicker";
import AttachmentMenu from "../AttachmentMenu/AttachmentMenu";

export default function ChatWindow({
  activeChat,
  onSend,
  onShowDetails,
  onBack,
}) {
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const pickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const attachRef = useRef(null);
  const attachButtonRef = useRef(null);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput("");
    setShowEmojiPicker(false);
  };

  const handleAttachFiles = (type, files) => {
    // Wire this up to your actual upload/send logic
    console.log("Selected via", type, files);
    setShowAttachMenu(false);
  };

  const handleAttachAction = (actionId) => {
    // Camera / Contact / Poll / Sticker — no real handler yet
    console.log("Attachment action:", actionId);
    setShowAttachMenu(false);
  };

  useEffect(() => {
    if (!showEmojiPicker && !showAttachMenu) return;
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker, showAttachMenu]);

  if (!activeChat) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-(--app-bg) min-w-0 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-(--panel-bg) border border-(--border) flex items-center justify-center mb-4">
          <MessageCircle className="text-(--accent)" size={28} />
        </div>
        <h2 className="text-(--text-primary) font-semibold text-lg">Welcome to Talkora</h2>
        <p className="text-(--text-muted) text-sm mt-1">Choose a chat to start a conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-(--app-bg) min-w-0">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-(--border) bg-(--panel-bg)">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button type="button" onClick={onBack} className="md:hidden rounded-lg p-1 -ml-1 text-gray-400 hover:text-white transition shrink-0" title="Back to chats">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm shrink-0" style={{ backgroundColor: activeChat.avatarColor || "#10B981" }}>
            {activeChat.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">{activeChat.name}</p>
            <p className="text-xs text-gray-500">{activeChat.online ? "Online" : "Offline"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-gray-400 shrink-0">
          <div className="relative group hidden sm:block">
            <button type="button" aria-label="Audio call" className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition" title="Coming soon">
              <Phone size={18} />
            </button>
            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 z-20">
              Coming soon
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </span>
          </div>

          <div className="relative group hidden sm:block">
            <button type="button" aria-label="Video call" className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition" title="Coming soon">
              <Video size={18} />
            </button>
            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 z-20">
              Coming soon
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </span>
          </div>

          <button type="button" onClick={onShowDetails} className="rounded-lg p-1 hover:bg-[#334155] hover:text-white transition" title="View chat details">
            <Info size={18} />
          </button>
          <MoreVertical size={18} className="hidden sm:block cursor-pointer hover:text-white transition" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4">
        {activeChat.messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} isOwn={msg.isOwn} avatarColor={activeChat.avatarColor} name={activeChat.name} />
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-t border-(--border) bg-(--panel-bg)">
        <button
          ref={attachButtonRef}
          type="button"
          onClick={() => setShowAttachMenu((v) => !v)}
          className={`hidden sm:flex items-center justify-center text-gray-400 hover:text-white transition shrink-0 ${showAttachMenu ? "text-(--accent)" : ""}`}
          title="Attach"
        >
          <Paperclip size={20} />
        </button>

        {showAttachMenu && (
          <div ref={attachRef} className="absolute bottom-full left-3 mb-2 z-30">
            <AttachmentMenu onSelectFiles={handleAttachFiles} onAction={handleAttachAction} />
          </div>
        )}

        <button
          ref={emojiButtonRef}
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          className={`hidden sm:flex items-center justify-center text-gray-400 hover:text-white transition shrink-0 ${showEmojiPicker ? "text-(--accent)" : ""}`}
          title="Insert emoji"
        >
          <Smile size={20} />
        </button>

        {showEmojiPicker && (
          <div ref={pickerRef} className="absolute bottom-full left-3 sm:left-16 mb-2 z-30">
            <EmojiPicker onSelect={(emoji) => setInput((prev) => prev + emoji)} />
          </div>
        )}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 bg-(--input-bg) border border-(--border) rounded-full text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent"
        />

        <button type="submit" className="w-10 h-10 rounded-full flex items-center justify-center bg-(--accent) text-[#F8FAFC] shrink-0 transition-transform hover:scale-105 active:scale-95">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}