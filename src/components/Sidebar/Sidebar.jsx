import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Search, LogOut, Plus, MessageSquare } from "lucide-react";
import { logoutUser } from "../../redux/authSlice";

const dummyChats = [
  { id: 1, name: "Sarah Khan", lastMsg: "See you tomorrow then!", time: "10:42 AM", unread: 2, online: true, avatarColor: "#3B82F6" },
  { id: 2, name: "Ali Raza", lastMsg: "Sent the files, check them out", time: "9:15 AM", unread: 0, online: true, avatarColor: "#10B981" },
  { id: 3, name: "Design Team", lastMsg: "Fatima: Let's finalize the colors", time: "Yesterday", unread: 5, online: false, avatarColor: "#F59E0B" },
  { id: 4, name: "Ahmed Hassan", lastMsg: "Sounds good 👍", time: "Yesterday", unread: 0, online: false, avatarColor: "#8B5CF6" },
  { id: 5, name: "Zainab Malik", lastMsg: "Thanks for the update!", time: "Mon", unread: 0, online: true, avatarColor: "#EC4899" },
  { id: 6, name: "Project Alpha", lastMsg: "Usman: meeting at 3pm", time: "Sun", unread: 0, online: false, avatarColor: "#06B6D4" },
];

export default function Sidebar({ activeChat, setActiveChat }) {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [search, setSearch] = useState("");

  const filteredChats = dummyChats.filter((chat) =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-[var(--panel-bg)] border-r border-[var(--border)]">
      {/* Conversation header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)]">
        <div className="w-9 h-9 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
          <MessageSquare size={18} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Chats</h1>
          <p className="text-xs text-[var(--text-muted)]">Your conversations</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full pl-9 pr-3 py-2 bg-[var(--input-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-4 py-2">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[#F8FAFC] font-medium text-sm hover:opacity-90 transition">
          <Plus size={18} />
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-2">
        {filteredChats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => setActiveChat(chat)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1 text-left transition ${
              activeChat?.id === chat.id ? "bg-[var(--border)]" : "hover:bg-[var(--input-bg)]"
            }`}
          >
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm"
                style={{ backgroundColor: chat.avatarColor }}
              >
                {chat.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              {chat.online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] rounded-full border-2 border-[#1E293B]" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{chat.name}</p>
                <span className="text-xs text-[var(--text-muted)] shrink-0 ml-2">{chat.time}</span>
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <p className="text-xs text-[var(--text-secondary)] truncate">{chat.lastMsg}</p>
                {chat.unread > 0 && (
                  <span className="ml-2 bg-[#3B82F6] text-[#F8FAFC] text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Active user footer */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--border)]">
        {user?.picture ? (
          <img src={user.picture} alt="You" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[var(--status)] flex items-center justify-center text-[#F8FAFC] text-xs font-semibold">
            {user?.name?.[0] || "U"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.name || "You"}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
        </div>
        <button
          onClick={() => dispatch(logoutUser())}
          className="text-gray-400 hover:text-red-400 transition"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}