import { useState } from "react";
import { Send, Paperclip, Smile, Phone, Video, MoreVertical, MessageCircle, Info } from "lucide-react";
import ChatBubble from "../ChatBubble/ChatBubble";

const dummyMessages = [
  { id: 1, text: "Hey! How's the project going?", time: "10:30 AM", isOwn: false },
  { id: 2, text: "Going well! Just finished the auth flow", time: "10:32 AM", isOwn: true },
  { id: 3, text: "Nice, that's the hard part done then 🎉", time: "10:33 AM", isOwn: false },
  { id: 4, text: "Yeah exactly, now working on the chat UI", time: "10:35 AM", isOwn: true },
  { id: 5, text: "See you tomorrow then!", time: "10:42 AM", isOwn: false },
];

export default function ChatWindow({ activeChat, onShowDetails }) {
  const [messages, setMessages] = useState(dummyMessages);
  const [input, setInput] = useState("");

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([
      ...messages,
      {
        id: messages.length + 1,
        text: input,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isOwn: true,
      },
    ]);
    setInput("");
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--app-bg)] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <MessageCircle className="text-gray-500" size={28} />
        </div>
        <h2 className="text-white font-semibold text-lg">Welcome to Talkora</h2>
        <p className="text-gray-500 text-sm mt-1">Select a conversation to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg)]">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--panel-bg)]">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm"
            style={{ backgroundColor: activeChat.avatarColor || "#10B981" }}
          >
            {activeChat.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <p className="text-white font-medium text-sm">{activeChat.name}</p>
            <p className="text-xs text-gray-500">{activeChat.online ? "Online" : "Offline"}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <Phone size={18} className="cursor-pointer hover:text-white transition" />
          <Video size={18} className="cursor-pointer hover:text-white transition" />
          <button
            type="button"
            onClick={onShowDetails}
            className="rounded-lg p-1 hover:bg-[#334155] hover:text-white transition"
            title="View chat details"
          >
            <Info size={18} />
          </button>
          <MoreVertical size={18} className="cursor-pointer hover:text-white transition" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} isOwn={msg.isOwn} />
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-3 px-5 py-3 border-t border-[var(--border)] bg-[var(--panel-bg)]">
        <Paperclip className="text-gray-400 cursor-pointer hover:text-white transition shrink-0" size={20} />
        <Smile className="text-gray-400 cursor-pointer hover:text-white transition shrink-0" size={20} />
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