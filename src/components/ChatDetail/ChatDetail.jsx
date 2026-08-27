import { Bell, Ban, Image as ImageIcon, X } from "lucide-react";

export default function ChatDetails({ activeChat, onClose }) {
  if (!activeChat) return null;

  return (
    <div className="custom-scrollbar w-70 shrink-0 h-full bg-[var(--panel-bg)] border-l border-[var(--border)] overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Chat details</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition"
          title="Close chat details"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-col items-center text-center px-5 py-6 border-b border-[var(--border)]">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-[#F8FAFC] text-2xl font-semibold mb-3"
          style={{ backgroundColor: activeChat.avatarColor || "#10B981" }}
        >
          {activeChat.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <p className="text-white font-semibold">{activeChat.name}</p>
        <p className="text-xs text-gray-500 mt-1">
          {activeChat.online ? "Online" : "Offline"}
        </p>
      </div>

      <div className="px-5 py-4 border-b border-[#334155]">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Shared media</p>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"
            >
              <ImageIcon size={16} className="text-gray-600" />
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Settings</p>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition">
          <Bell size={16} />
          Mute notifications
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition">
          <Ban size={16} />
          Block contact
        </button>
      </div>
    </div>
  );
}