import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Search, LogOut } from "lucide-react";
import { getAvatarColor } from "../../utils/avatarColor";

import { logoutUser } from "../../redux/authSlice";
import {
  startApiLoading,
  stopApiLoading,
} from "../../redux/apiLoadingSlice";

const API_BASE_URL = "http://localhost:3000/api";

export default function Sidebar({
  activeChat,
  setActiveChat,
  collapsed,
  refreshKey = 0,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Logged-in user + token from Redux
  const { user, token } = useSelector((state) => state.auth);

  // Sidebar search
  const [search, setSearch] = useState("");

  // Conversations from backend
  const [conversations, setConversations] = useState([]);

  // Local loading flag just for the conversation list
  const [loadingConversations, setLoadingConversations] = useState(false);

  // ==========================================
  // FETCH MY CONVERSATIONS
  // ==========================================
  const fetchConversations = useCallback(async () => {
    setLoadingConversations(true);
    dispatch(startApiLoading("fetchConversations"));

    try {
      const response = await fetch(
        `${API_BASE_URL}/conversations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // ==========================================
      // TOKEN EXPIRED / INVALID
      // ==========================================
      if (response.status === 401) {
        dispatch(logoutUser());
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data = await response.json();

      setConversations(data || []);
    } catch (error) {
      console.error(
        "Failed to fetch conversations:",
        error
      );
    } finally {
      setLoadingConversations(false);
      dispatch(stopApiLoading("fetchConversations"));
    }
  }, [token, dispatch, navigate]);

  // ==========================================
  // FETCH WHEN TOKEN / REFRESH KEY CHANGES
  // ==========================================
  useEffect(() => {
    if (token) {
      fetchConversations();
    }
  }, [token, fetchConversations, refreshKey]);

  // ==========================================
  // SEARCH EXISTING CONVERSATIONS
  // ==========================================
  const filteredConversations = conversations.filter(
    (c) =>
      c.otherUser?.name
        ?.toLowerCase()
        .includes(search.toLowerCase())
  );

  const fullBlock = collapsed ? "hidden" : "block";
  const fullContent = collapsed ? "hidden" : "flex";

  // ==========================================
  // LOGOUT
  // ==========================================
  const handleLogout = () => {
    dispatch(logoutUser());
    navigate("/login");
  };

  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div
      className={`h-full flex flex-col bg-(--panel-bg) border-r border-(--border) shrink-0 transition-all duration-200 ${
        collapsed
          ? "w-19"
          : "w-full sm:w-[300px] lg:w-[320px]"
      }`}
    >
      {/* ==========================================
          SEARCH
      ========================================== */}
      <div className={`px-3 py-3 ${fullBlock}`}>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            size={16}
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full pl-9 pr-3 py-2 bg-(--input-bg) border border-(--border) rounded-lg text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent"
          />
        </div>
      </div>

      {/* ==========================================
          CONVERSATION LIST
      ========================================== */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-2">
        {/* Small inline loader — only covers this list, not the page */}
        {loadingConversations && conversations.length === 0 && (
          <div className={`flex justify-center py-6 ${fullBlock}`}>
            <div className="w-5 h-5 border-2 border-(--border) border-t-(--accent) rounded-full animate-spin" />
          </div>
        )}

        {!loadingConversations &&
          filteredConversations.map((c) => {
            const otherUser = c.otherUser;

            if (!otherUser) return null;

            const userInitials = otherUser.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <button
                key={c.conversationId}
                type="button"
                onClick={() =>
                  setActiveChat({
                    ...otherUser,
                    conversationId: c.conversationId,
                  })
                }
                title={otherUser.name}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1 text-left transition ${
                  collapsed
                    ? "justify-center"
                    : "justify-center sm:justify-start"
                } ${
                  activeChat?.conversationId ===
                  c.conversationId
                    ? "bg-(--border)"
                    : "hover:bg-(--input-bg)"
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {otherUser.avatarUrl ? (
                    <img
                      src={otherUser.avatarUrl}
                      alt={otherUser.name}
                      className="w-11 h-11 rounded-full object-cover border border-(--border)"
                    />
                  ) : (
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm"
                      style={{
                        backgroundColor:
                          getAvatarColor(otherUser.id),
                      }}
                    >
                      {userInitials}
                    </div>
                  )}
                </div>

                {/* User Information */}
                <div
                  className={`flex-1 min-w-0 ${fullBlock}`}
                >
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-(--text-primary) truncate">
                      {otherUser.name}
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-xs text-(--text-secondary) truncate">
                      {c.lastMessage || otherUser.email}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

        {/* No conversations */}
        {!loadingConversations &&
          filteredConversations.length === 0 && (
            <p
              className={`text-sm text-(--text-muted) text-center py-6 ${fullBlock}`}
            >
              No conversations yet. Open Settings → Add
              Contact to start one.
            </p>
          )}
      </div>

      {/* ==========================================
          CURRENT USER FOOTER
      ========================================== */}
      <div
        className={`flex items-center gap-3 px-4 py-3 border-t border-(--border) ${
          collapsed
            ? "justify-center"
            : "justify-center sm:justify-start"
        }`}
      >
        {/* Current User Avatar */}
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={`${user.name || "User"} profile`}
            className="w-9 h-9 rounded-full object-cover shrink-0 border border-(--border)"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#F8FAFC] text-xs font-semibold shrink-0"
            style={{
              backgroundColor: getAvatarColor(user?.id),
            }}
          >
            {userInitial}
          </div>
        )}

        {/* Current User Information */}
        <div
          className={`flex-1 min-w-0 ${fullBlock}`}
        >
          <p className="text-sm font-medium text-(--text-primary) truncate">
            {user?.name || "User"}
          </p>

          <p className="text-xs text-(--text-muted) truncate">
            {user?.email || "No email"}
          </p>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className={`text-gray-400 hover:text-red-400 transition shrink-0 ${fullContent}`}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}