import { useState } from "react";
import { Send, Paperclip, Smile, Phone, Video, MoreVertical, MessageCircle, Info, ArrowLeft } from "lucide-react";
import ChatBubble from "../ChatBubble/ChatBubble";

export default function ChatWindow({ activeChat, onSend, onShowDetails, onBack }) {
  const [input, setInput] = useState("");

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  if (!activeChat) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[var(--app-bg)] min-w-0 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-[var(--panel-bg)] border border-[var(--border)] flex items-center justify-center mb-4">
          <MessageCircle className="text-[var(--accent)]" size={28} />
        </div>
        <h2 className="text-[var(--text-primary)] font-semibold text-lg">Welcome to Talkora</h2>
        <p className="text-[var(--text-muted)] text-sm mt-1">Choose a chat to start a conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg)] min-w-0">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[var(--border)] bg-[var(--panel-bg)]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden rounded-lg p-1 -ml-1 text-gray-400 hover:text-white transition shrink-0"
            title="Back to chats"
          >
            <ArrowLeft size={20} />
          </button>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm shrink-0"
            style={{ backgroundColor: activeChat.avatarColor || "#10B981" }}
          >
            {activeChat.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">{activeChat.name}</p>
            <p className="text-xs text-gray-500">{activeChat.online ? "Online" : "Offline"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-gray-400 shrink-0">
          <Phone size={18} className="hidden sm:block cursor-pointer hover:text-white transition" />
          <Video size={18} className="hidden sm:block cursor-pointer hover:text-white transition" />
          <button
            type="button"
            onClick={onShowDetails}
            className="rounded-lg p-1 hover:bg-[#334155] hover:text-white transition"
            title="View chat details"
          >
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
      <form onSubmit={handleSend} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-t border-[var(--border)] bg-[var(--panel-bg)]">
        <Paperclip className="hidden sm:block text-gray-400 cursor-pointer hover:text-white transition shrink-0" size={20} />
        <Smile className="hidden sm:block text-gray-400 cursor-pointer hover:text-white transition shrink-0" size={20} />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-full text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        />
        <button
          type="submit"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--accent)] text-[#F8FAFC] shrink-0 transition-transform hover:scale-105 active:scale-95"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}