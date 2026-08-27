import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Search, LogOut, Plus } from "lucide-react";
import { logoutUser } from "../../redux/authSlice";

const dummyChats = [
  { id: 1, name: "Sarah Khan", lastMsg: "See you tomorrow then!", time: "10:42 AM", unread: 2, online: true, avatarColor: "#3B82F6", messages: [{ id: 1, text: "Hey! How's the project going?", time: "10:30 AM", isOwn: false }, { id: 2, text: "Going well! Just finished the auth flow", time: "10:32 AM", isOwn: true }, { id: 3, text: "Nice, that's the hard part done then!", time: "10:33 AM", isOwn: false }, { id: 4, text: "See you tomorrow then!", time: "10:42 AM", isOwn: false }] },
  { id: 2, name: "Ali Raza", lastMsg: "Sent the files, check them out", time: "9:15 AM", unread: 0, online: true, avatarColor: "#10B981", messages: [{ id: 1, text: "The new dashboard is ready for review.", time: "9:02 AM", isOwn: false }, { id: 2, text: "Great, I will look through it now.", time: "9:06 AM", isOwn: true }, { id: 3, text: "Sent the files, check them out", time: "9:15 AM", isOwn: false }] },
  { id: 3, name: "Design Team", lastMsg: "Fatima: Let's finalize the colors", time: "Yesterday", unread: 5, online: false, avatarColor: "#F59E0B", messages: [{ id: 1, text: "I added the latest mobile screens to the board.", time: "4:18 PM", isOwn: false }, { id: 2, text: "The spacing feels much better now.", time: "4:26 PM", isOwn: true }, { id: 3, text: "Fatima: Let's finalize the colors", time: "4:41 PM", isOwn: false }] },
  { id: 4, name: "Ahmed Hassan", lastMsg: "Sounds good!", time: "Yesterday", unread: 0, online: false, avatarColor: "#8B5CF6", messages: [{ id: 1, text: "Are we still on for the workshop tomorrow?", time: "2:10 PM", isOwn: false }, { id: 2, text: "Yes, I booked the small meeting room.", time: "2:23 PM", isOwn: true }, { id: 3, text: "Sounds good!", time: "2:24 PM", isOwn: false }] },
  { id: 5, name: "Zainab Malik", lastMsg: "Thanks for the update!", time: "Mon", unread: 0, online: true, avatarColor: "#EC4899", messages: [{ id: 1, text: "I have shared the weekly notes by email.", time: "11:05 AM", isOwn: false }, { id: 2, text: "Thanks for the update!", time: "11:14 AM", isOwn: true }] },
  { id: 6, name: "Project Alpha", lastMsg: "Usman: meeting at 3pm", time: "Sun", unread: 0, online: false, avatarColor: "#06B6D4", messages: [{ id: 1, text: "Reminder: sprint planning is this afternoon.", time: "8:40 AM", isOwn: false }, { id: 2, text: "Usman: meeting at 3pm", time: "8:52 AM", isOwn: false }] },
];

export default function Sidebar({ activeChat, setActiveChat, collapsed }) {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [search, setSearch] = useState("");

  const filteredChats = dummyChats.filter((chat) =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );

  const fullContent = collapsed ? "hidden" : "flex";
  const fullBlock = collapsed ? "hidden" : "block";

  return (
    <div
      className={`h-full flex flex-col bg-[var(--panel-bg)] border-r border-[var(--border)] shrink-0 transition-all duration-200 ${
        collapsed ? "w-[76px]" : "w-full sm:w-[300px] lg:w-[320px]"
      }`}
    >
      {/* Search */}
      <div className={`px-3 py-3 ${fullBlock}`}>
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

      {/* New Chat — full button when expanded, icon-only when collapsed */}
      <div className="px-3 py-2 flex justify-center">
        <button className={`w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[#F8FAFC] font-medium text-sm hover:opacity-90 transition ${fullContent}`}>
          <Plus size={18} />
          New Chat
        </button>
        <button
          className={`${collapsed ? "hidden sm:flex" : "hidden"} w-11 h-11 items-center justify-center rounded-lg bg-[var(--accent)] text-[#F8FAFC] hover:opacity-90 transition`}
          title="New chat"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Chat list */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-2">
        {filteredChats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => setActiveChat(chat)}
            title={chat.name}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1 text-left transition ${
              collapsed ? "justify-center" : "justify-center sm:justify-start"
            } ${activeChat?.id === chat.id ? "bg-[var(--border)]" : "hover:bg-[var(--input-bg)]"}`}
          >
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm"
                style={{ backgroundColor: chat.avatarColor }}
              >
                {chat.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              {chat.online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] rounded-full border-2 border-[var(--panel-bg)]" />
              )}
              {chat.unread > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#3B82F6] rounded-full border border-[var(--panel-bg)] ${collapsed ? "block" : "block sm:hidden"}`} />
              )}
            </div>

            <div className={`flex-1 min-w-0 ${fullBlock}`}>
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
      <div className={`flex items-center gap-3 px-4 py-3 border-t border-[var(--border)] ${collapsed ? "justify-center" : "justify-center sm:justify-start"}`}>
        {user?.picture ? (
          <img src={user.picture} alt="You" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[var(--status)] flex items-center justify-center text-[#F8FAFC] text-xs font-semibold shrink-0">
            {user?.name?.[0] || "U"}
          </div>
        )}
        <div className={`flex-1 min-w-0 ${fullBlock}`}>
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.name || "You"}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
        </div>
        <button
          onClick={() => dispatch(logoutUser())}
          className={`text-gray-400 hover:text-red-400 transition shrink-0 ${fullContent}`}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}