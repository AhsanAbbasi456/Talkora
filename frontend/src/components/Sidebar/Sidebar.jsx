import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Check,
  CheckCheck,
  Mic,
  Phone,
  Video,
} from "lucide-react";
import { getAvatarColor } from "../../utils/avatarColor";
import { formatLastMessageTime } from "../../utils/formatLastMessageTime";
import socket from "../../socket";
import { logoutUser } from "../../redux/authSlice";
import { startApiLoading, stopApiLoading } from "../../redux/apiLoadingSlice";

const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3002"}/api`;

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatDuration = (s = 0) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const FILE_PREVIEWS = { IMAGE: "📷 Photo", VIDEO: "🎥 Video" };

// Text shown under the chat name in the sidebar
const getMessagePreview = (message) =>
  message?.messageType === "CALL"
        ? message.fileName === "video"
      ? "Video call"
      : "Voice call"
    : message?.body ||
      (message?.messageType === "DOCUMENT"
        ? `📄 ${message.fileName || "Document"}`
        : message?.messageType === "AUDIO"
          ? `🎤 ${formatDuration(message.duration || 0)}`
          : FILE_PREVIEWS[message?.messageType] || null);

// Updates the "last message" fields of one conversation
const withPreview = (conversation, message) => ({
  ...conversation,
  lastMessage: getMessagePreview(message),
  lastMessageAt: message.createdAt,
    lastMessageSenderId: message.senderId,
    lastMessageReadAt: message.readAt ?? null,
    lastMessageType: message.messageType,
    lastCallStatus: message.messageType === "CALL" ? message.body : null,
});

const sortByLatest = (items) =>
  [...items].sort(
    (a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0),
  );

function Avatar({
  person,
  sizeClass,
  textClass,
  borderClass,
  initials = getInitials(person?.name) || "U",
}) {
  return person?.avatarUrl ? (
    <img
      src={person.avatarUrl}
      alt={person.name || ""}
      className={`${sizeClass} rounded-full object-cover shrink-0 border ${borderClass}`}
    />
  ) : (
    <div
      className={`${sizeClass} ${textClass} rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold shrink-0`}
      style={{ backgroundColor: getAvatarColor(person?.id) }}
    >
      {initials}
    </div>
  );
}

export default function Sidebar({
  activeChat,
  setActiveChat,
  collapsed,
  refreshKey = 0,
  onUnreadChange,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // "all" or "unread"
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});

  const typingTimers = useRef({});
  const pendingUnreadRef = useRef({});

  // ---------- fetch conversations ----------
  const fetchConversations = useCallback(async () => {
    if (!token) return;

    setLoadingConversations(true);
    dispatch(startApiLoading("fetchConversations"));

    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        dispatch(logoutUser());
        navigate("/login");
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch conversations");

      const data = await response.json();
      const pending = { ...pendingUnreadRef.current };
      pendingUnreadRef.current = {};

      setConversations((prev) => {
        const previous = new Map(
          prev.map((c) => [c.conversationId, c.unreadCount || 0]),
        );

        return sortByLatest(
          (data || []).map((conversation) => {
            const pendingCount = pending[Number(conversation.conversationId)];

            return {
              ...conversation,
              unreadCount:
                Number(activeChat?.conversationId) ===
                Number(conversation.conversationId)
                  ? 0
                  : Number.isInteger(pendingCount)
                    ? pendingCount
                    : (previous.get(conversation.conversationId) ??
                      conversation.unreadCount ??
                      0),
            };
          }),
        );
      });
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoadingConversations(false);
      dispatch(stopApiLoading("fetchConversations"));
    }
  }, [token, dispatch, navigate, activeChat?.conversationId]);

  useEffect(() => {
    if (token) fetchConversations();
  }, [token, fetchConversations, refreshKey]);

    // make sure the Talkora AI chat exists, then refresh the list
  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE_URL}/ai/chat`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => fetchConversations())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---------- typing indicator ----------
  const clearTyping = useCallback((id) => {
    clearTimeout(typingTimers.current[id]);

    setTypingUsers((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    const onTyping = ({ userId, isTyping }) => {
      const id = Number(userId);

      if (!isTyping) return clearTyping(id);

      clearTimeout(typingTimers.current[id]);
      setTypingUsers((prev) => ({ ...prev, [id]: true }));
      typingTimers.current[id] = setTimeout(() => clearTyping(id), 5000);
    };

    socket.on("typing", onTyping);
    const timers = typingTimers.current;

    return () => {
      socket.off("typing", onTyping);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [clearTyping]);

  // ---------- incoming / sent / offline messages ----------
  useEffect(() => {
    if (!token || !user?.id) return;

    const me = Number(user.id);

    const onIncoming = (message) => {
      const senderId = Number(message.senderId);
      const conversationId = Number(message.conversationId);
      const isGroupMessage =
        message.conversationType === "GROUP" || message.receiverId == null;
      const receiverId = Number(message.receiverId ?? me);
      const otherId = senderId === me ? receiverId : senderId;

      if (!isGroupMessage) clearTyping(otherId);

      setConversations((prev) => {
        // match by chat first: a Talkora AI answer to an @mention is sent by the bot
        // but belongs to the chat it was asked in, not to the Talkora AI chat
        const existing =
          prev.find((c) => Number(c.conversationId) === conversationId) ||
          (!isGroupMessage && prev.find((c) => Number(c.otherUser?.id) === otherId));

        if (!existing) {
          if (Number(message.count) > 0) {
            pendingUnreadRef.current[conversationId] = Number(message.count);
          }
          fetchConversations();
          return prev;
        }

        const isOpen =
          Number(activeChat?.conversationId) ===
          Number(existing.conversationId);
        const count = Number(message.count);

        return sortByLatest(
          prev.map((c) =>
            c.conversationId === existing.conversationId
              ? {
                  ...withPreview(c, message),
                  unreadCount: isOpen
                    ? 0
                    : count > 0
                      ? count
                      : (c.unreadCount || 0) + 1,
                }
              : c,
          ),
        );
      });
    };

    const onOffline = (message) =>
      onIncoming({ ...message, receiverId: message.receiverId || user.id });

    // my own message
    const onSent = (message) => {
      if (Number(message.senderId) !== me) return;

      const isGroupMessage =
        message.conversationType === "GROUP" || message.receiverId == null;

      setConversations((prev) => {
        const existing = prev.find((c) =>
          isGroupMessage
            ? c.type === "GROUP" &&
              Number(c.conversationId) === Number(message.conversationId)
            : Number(c.otherUser?.id) === Number(message.receiverId),
        );

        if (!existing) {
          fetchConversations();
          return prev;
        }

        return sortByLatest(
          prev.map((c) =>
            c.conversationId === existing.conversationId
              ? withPreview(c, message)
              : c,
          ),
        );
      });
    };

    socket.on("newMessage", onIncoming);
    socket.on("offlineMessageNotification", onOffline);
    socket.on("messageSent", onSent);
    const onMessageDeleted = () => fetchConversations();
    socket.on("messageDeleted", onMessageDeleted);
    socket.on("messageRestored", onMessageDeleted);

    return () => {
      socket.off("newMessage", onIncoming);
      socket.off("offlineMessageNotification", onOffline);
      socket.off("messageSent", onSent);
      socket.off("messageDeleted", onMessageDeleted);
      socket.off("messageRestored", onMessageDeleted);
    };
  }, [
    token,
    user?.id,
    activeChat?.conversationId,
    fetchConversations,
    clearTyping,
  ]);
  // ---------- the other person read my last message ----------
  useEffect(() => {
    const onRead = ({ readerId, readAt }) =>
      setConversations((prev) =>
        prev.map((c) =>
          c.type === "DIRECT" &&
          Number(c.otherUser?.id) === Number(readerId) &&
          Number(c.lastMessageSenderId) === Number(user?.id)
            ? { ...c, lastMessageReadAt: readAt }
            : c
        )
      );

    socket.on("messagesRead", onRead);
    return () => socket.off("messagesRead", onRead);
  }, [user?.id]);
    // ---------- the other person read my last message ----------
  useEffect(() => {
    const onRead = ({ readerId, readAt }) =>
      setConversations((prev) =>
        prev.map((c) =>
          c.type === "DIRECT" &&
          Number(c.otherUser?.id) === Number(readerId) &&
          Number(c.lastMessageSenderId) === Number(user?.id)
            ? { ...c, lastMessageReadAt: readAt }
            : c
        )
      );

    socket.on("messagesRead", onRead);
    return () => socket.off("messagesRead", onRead);
  }, [user?.id]);

  // ---------- online status of the other person (for the delivered tick) ----------
  useEffect(() => {
    const onPresence = ({ userId, isOnline }) =>
      setConversations((prev) =>
        prev.map((c) =>
          c.type === "DIRECT" && Number(c.otherUser?.id) === Number(userId)
            ? { ...c, otherUser: { ...c.otherUser, isOnline: Boolean(isOnline) } }
            : c
        )
      );

    socket.on("presence", onPresence);
    return () => socket.off("presence", onPresence);
  }, []);

  // ---------- open conversation ----------
  const handleConversationClick = (conversation) => {
    setConversations((prev) =>
      prev.map((item) =>
        item.conversationId === conversation.conversationId
          ? { ...item, unreadCount: 0 }
          : item,
      ),
    );

    if (conversation.type === "DIRECT") {
      if (!conversation.otherUser) return;

      setActiveChat({
        ...conversation.otherUser,
        conversationId: conversation.conversationId,
        type: "DIRECT",
      });
      return;
    }

    setActiveChat({
      id: conversation.conversationId,
      conversationId: conversation.conversationId,
      type: "GROUP",
      name: conversation.name,
      avatarUrl: conversation.avatarUrl,
      description: conversation.description,
      createdBy: conversation.createdBy,
      members: conversation.members || [],
    });
  };

  // ---------- search ----------
  const searchText = search.toLowerCase().trim();

    const unreadChats = conversations.filter((c) => c.unreadCount > 0).length;

  const filteredConversations = conversations.filter((conversation) => {
    // in "Unread" mode keep the open chat visible, so it doesn't vanish when you click it
    if (
      filter === "unread" &&
      !conversation.unreadCount &&
      Number(activeChat?.conversationId) !== Number(conversation.conversationId)
    ) {
      return false;
    }

    if (!searchText) return true;

    if (conversation.type === "DIRECT") {
      return (
        conversation.otherUser?.name?.toLowerCase().includes(searchText) ||
        conversation.otherUser?.email?.toLowerCase().includes(searchText)
      );
    }

    return conversation.name?.toLowerCase().includes(searchText);
  });

  // ---------- total unread ----------
  const totalUnreadCount = conversations.reduce(
    (sum, c) => sum + (c.unreadCount || 0),
    0,
  );

  useEffect(() => {
    onUnreadChange?.(totalUnreadCount);
  }, [totalUnreadCount, onUnreadChange]);

  // ---------- UI ----------
  const fullBlock = collapsed ? "hidden" : "block";
  const rowAlign = collapsed
    ? "justify-center"
    : "justify-center sm:justify-start";

  return (
    <div
      className={`h-full flex flex-col bg-(--panel-bg) border-r border-(--border) shrink-0 transition-all duration-200 ${
        collapsed ? "w-19" : "w-full md:w-[300px] lg:w-[320px]"
      }`}
    >
      {/* SEARCH */}
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

        <div className="mt-2.5 flex items-center gap-2">
          {[
            ["all", "All"],
            ["unread", unreadChats > 0 ? `Unread ${unreadChats}` : "Unread"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === id
                  ? "border-(--accent) bg-(--accent)/15 text-(--accent)"
                  : "border-(--border) text-(--text-muted) hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        </div>
    

      {/* CONVERSATIONS */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-2">
        {loadingConversations && conversations.length === 0 && (
          <div className={`flex justify-center py-6 ${fullBlock}`}>
            <div className="w-5 h-5 border-2 border-(--border) border-t-(--accent) rounded-full animate-spin" />
          </div>
        )}

        {!loadingConversations &&
          filteredConversations.map((conversation) => {
            const isGroup = conversation.type === "GROUP";
            const otherUser = conversation.otherUser;

            const displayPerson = isGroup
              ? {
                  id: conversation.conversationId,
                  name: conversation.name || "Unnamed Group",
                  avatarUrl: conversation.avatarUrl || null,
                }
              : otherUser;

            if (!displayPerson) return null;

            const displayName =
              displayPerson.name ||
              (isGroup ? "Unnamed Group" : "Unknown User");

            const unreadCount = conversation.unreadCount || 0;
            const badgeText = unreadCount > 99 ? "99+" : unreadCount;

            // typing is only shown for DIRECT chats
            const isTyping = !isGroup && !!typingUsers[Number(otherUser?.id)];
            const lastFromMe =
              Number(conversation.lastMessageSenderId) === Number(user?.id);
                                      const showTick =
              !isGroup &&
              lastFromMe &&
              !isTyping &&
              !!conversation.lastMessage &&
              conversation.lastMessageType !== "CALL";
                          // voice message (the startsWith check skips "This message was deleted")
            const isAudio =
              conversation.lastMessageType === "AUDIO" &&
              conversation.lastMessage?.startsWith("🎤");
                          // call row: green when the call was completed, red otherwise
                          const isCall = conversation.lastMessageType === "CALL";
                          const CallIcon = conversation.lastMessage === "Video call" ? Video : Phone;
            const isRead = Boolean(conversation.lastMessageReadAt);
            const isDelivered = Boolean(otherUser?.isOnline);

            return (
              <button
                key={conversation.conversationId}
                type="button"
                onClick={() => handleConversationClick(conversation)}
                title={displayName}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 text-left transition ${rowAlign} ${
                  activeChat?.conversationId === conversation.conversationId
                    ? "bg-[rgba(156,163,175,0.12)] border border-[rgba(255,255,255,0.06)]"
                    : "hover:bg-[rgba(148,163,184,0.08)]"
                } ${unreadCount > 0 ? "shadow-[inset_0_0_0_1px_rgba(34,197,94,0.08)]" : ""}`}
              >
                {/* AVATAR */}
                <div className="relative shrink-0">
                  <Avatar
                    person={displayPerson}
                    sizeClass="w-11 h-11"
                    textClass="text-sm"
                    borderClass="border-[rgba(255,255,255,0.09)]"
                    initials={getInitials(displayName) || (isGroup ? "G" : "U")}
                  />

                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#25D366] text-[#06230f] text-[10px] font-bold flex items-center justify-center border-2 border-(--panel-bg) shadow-lg">
                      {badgeText}
                    </span>
                  )}
                </div>

                {/* TEXT */}
                <div className={`flex-1 min-w-0 ${fullBlock}`}>
                  <div className="flex justify-between items-center gap-2">
                    <p
                      className={`text-sm truncate text-(--text-primary) ${
                        unreadCount > 0 ? "font-bold" : "font-medium"
                      }`}
                    >
                      {isGroup && <span className="mr-1">👥</span>}
                      {displayName}
                    </p>

                    <span className="text-[10px] text-(--text-secondary) shrink-0">
                      {formatLastMessageTime(conversation.lastMessageAt)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-1 gap-2">
                                       <p
                      className={`flex min-w-0 items-center gap-1 text-xs ${
                        isTyping
                          ? "text-(--accent)"
                          : unreadCount > 0
                            ? "text-(--text-primary) font-medium"
                            : "text-(--text-secondary)"
                      }`}
                    >
                                           {showTick &&
                        (isRead ? (
                          <CheckCheck size={15} className="shrink-0 text-[#34b7f1]" strokeWidth={2.6} />
                        ) : isDelivered ? (
                          <CheckCheck size={15} className="shrink-0 text-slate-500" strokeWidth={2.4} />
                        ) : (
                          <Check size={15} className="shrink-0 text-white" strokeWidth={2.8} />
                        ))}

                                            {isAudio && !isTyping && (
                        <Mic size={14} className="shrink-0 text-[#25D366]" />
                      )}
                      {isCall && !isTyping && (
                        <CallIcon
                          size={14}
                          className={`shrink-0 ${
                            conversation.lastCallStatus === "completed"
                              ? "text-[#25D366]"
                              : "text-red-500"
                          }`}
                        />
                      )}

                      <span className="truncate">
                        {isTyping
                          ? "typing..."
                          : conversation.lastMessage
                            ? isAudio
                              ? conversation.lastMessage.replace(/^🎤\s*/, "")
                              : conversation.lastMessage
                            : isGroup
                              ? `${conversation.members?.length || 0} members`
                              : "No messages yet"}
                      </span>
                    </p>

                    {unreadCount > 0 && (
                      <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-[#25D366] text-[#06230f] text-[10px] font-bold flex items-center justify-center">
                        {badgeText}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

        {/* EMPTY STATE */}
        {!loadingConversations && filteredConversations.length === 0 && (
          <p
            className={`text-sm text-(--text-muted) text-center py-6 ${fullBlock}`}
          >
                       {filter === "unread" ? "No unread chats" : "No conversations yet. Open Settings → Add Contact to start one."}
          </p>
        )}
      </div>

      {/* CURRENT USER */}
      <div
        className={`flex items-center gap-3 px-4 py-3 border-t border-(--border) ${rowAlign}`}
      >
        <Avatar
          person={user}
          sizeClass="w-9 h-9"
          textClass="text-xs"
          borderClass="border-(--border)"
          initials={user?.name?.charAt(0)?.toUpperCase() || "U"}
        />

        <div className={`flex-1 min-w-0 ${fullBlock}`}>
          <p className="text-sm font-medium text-(--text-primary) truncate">
            {user?.name || "User"}
          </p>
        </div>
      </div>
    </div>
  );
}
