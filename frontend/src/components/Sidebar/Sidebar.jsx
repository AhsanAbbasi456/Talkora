import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { getAvatarColor } from "../../utils/avatarColor";
import { formatLastMessageTime } from "../../utils/formatLastMessageTime";
import socket from "../../socket";

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
  onUnreadChange,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // ==========================================
  // AUTH
  // ==========================================

  const { user, token } = useSelector((state) => state.auth);

  // ==========================================
  // STATE
  // ==========================================

  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] =
    useState(false);

  // NEW: who is typing right now  { [userId]: true }
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimers = useRef({});

  // NEW (Edit 1): unread counts from offline notifications
  // that arrived before the conversation list was loaded
  // { [senderId]: count }
  const pendingUnreadRef = useRef({});

  // ==========================================
  // SORT CONVERSATIONS
  // ==========================================

  const sortConversationsByLatest = (items = []) =>
    [...items].sort((a, b) => {
      const aTime = a?.lastMessageAt
        ? new Date(a.lastMessageAt).getTime()
        : 0;

      const bTime = b?.lastMessageAt
        ? new Date(b.lastMessageAt).getTime()
        : 0;

      return bTime - aTime;
    });

  // ==========================================
  // FETCH MY CONVERSATIONS
  // ==========================================

  const fetchConversations = useCallback(async () => {
    if (!token) {
      return;
    }

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

      // ==========================================
      // KEEP EXISTING UNREAD COUNTS
      // (and apply any offline counts that arrived early)
      // ==========================================

      // NEW (Edit 2)
      const pendingUnread = { ...pendingUnreadRef.current };
      pendingUnreadRef.current = {};

      setConversations((previousConversations) => {
        const previousUnreadCounts = new Map(
          previousConversations.map((conversation) => [
            conversation.conversationId,
            conversation.unreadCount || 0,
          ])
        );

        return sortConversationsByLatest(
          (data || []).map((conversation) => ({
            ...conversation,
            unreadCount:
              previousUnreadCounts.get(
                conversation.conversationId
              ) ||
              pendingUnread[Number(conversation.otherUser?.id)] ||
              0,
          }))
        );
      });
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
  // NEW: TYPING INDICATOR IN THE SIDEBAR
  // ==========================================

  useEffect(() => {
    const clearTyping = (id) => {
      setTypingUsers((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };

    const onTyping = (data) => {
      const id = Number(data.userId);

      clearTimeout(typingTimers.current[id]);

      if (data.isTyping) {
        setTypingUsers((prev) => ({ ...prev, [id]: true }));

        // safety: hide after 5 seconds if "stopped" is lost
        typingTimers.current[id] = setTimeout(
          () => clearTyping(id),
          5000
        );
      } else {
        clearTyping(id);
      }
    };

    socket.on("typing", onTyping);

    const timers = typingTimers.current;

    return () => {
      socket.off("typing", onTyping);
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // ==========================================
  // RECEIVE NEW MESSAGE
  // ==========================================

  useEffect(() => {
    if (!token || !user?.id) {
      return;
    }

    const updateConversationForIncomingMessage = (message) => {
      console.log(
        "Sidebar received incoming message:",
        message
      );

      const senderId = Number(message.senderId);
      const receiverId = Number(message.receiverId ?? user.id);
      const currentUserId = Number(user.id);

      // ==========================================
      // FIND OTHER USER
      // ==========================================

      const otherUserId =
        senderId === currentUserId
          ? receiverId
          : senderId;

      // NEW: their message arrived, so they stopped typing
      clearTimeout(typingTimers.current[otherUserId]);

      setTypingUsers((prev) => {
        if (!prev[otherUserId]) return prev;
        const next = { ...prev };
        delete next[otherUserId];
        return next;
      });

      setConversations((prevConversations) => {
        const existingIndex =
          prevConversations.findIndex(
            (conversation) =>
              Number(
                conversation.otherUser?.id
              ) === otherUserId
          );

        // ==========================================
        // EXISTING CONVERSATION
        // ==========================================

        if (existingIndex !== -1) {
          const existingConversation =
            prevConversations[existingIndex];

          const conversationId =
            existingConversation.conversationId;

          // ==========================================
          // CHECK IF CHAT IS CURRENTLY OPEN
          // ==========================================

          const isChatOpen =
            activeChat?.conversationId ===
            conversationId;

          const currentUnreadCount =
            existingConversation.unreadCount || 0;

          // ==========================================
          // INCREASE UNREAD COUNT
          // ==========================================

          const unreadIncrement = Number(message.count) > 0 ? Number(message.count) : 1;
          const newUnreadCount = isChatOpen
            ? 0
            : message.count
            ? unreadIncrement
            : currentUnreadCount + 1;

          const updatedConversation = {
            ...existingConversation,
            lastMessage: message.body,
            lastMessageAt: message.createdAt,
            lastMessageSenderId: message.senderId, // NEW
            unreadCount: newUnreadCount,
          };

          const updatedConversations = [
            ...prevConversations,
          ];

          // Remove old position
          updatedConversations.splice(
            existingIndex,
            1
          );

          // Move conversation to top
          updatedConversations.unshift(
            updatedConversation
          );

          return sortConversationsByLatest(
            updatedConversations
          );
        }

        // ==========================================
        // NEW CONVERSATION
        // ==========================================

        // The socket message doesn't contain
        // complete user information.
        //
        // We fetch the conversations and then
        // add the unread count separately.

        // NEW (Edit 3): offline notification arrived before the
        // list loaded. Remember the count so fetchConversations
        // can apply it once the list is ready.
        if (Number(message.count) > 0) {
          pendingUnreadRef.current[otherUserId] = Number(message.count);
        }

        fetchConversations();

        return prevConversations;
      });
    };

    const handleNewMessage = (message) => {
      updateConversationForIncomingMessage(message);
    };

    const handleOfflineNotification = (message) => {
      updateConversationForIncomingMessage({
        ...message,
        senderId: message.senderId,
        receiverId: message.receiverId || user.id,
      });
    };

    socket.on(
      "newMessage",
      handleNewMessage
    );

    socket.on(
      "offlineMessageNotification",
      handleOfflineNotification
    );

    return () => {
      socket.off(
        "newMessage",
        handleNewMessage
      );

      socket.off(
        "offlineMessageNotification",
        handleOfflineNotification
      );
    };
  }, [
    token,
    user?.id,
    activeChat?.conversationId,
    fetchConversations,
  ]);

  // ==========================================
  // RECEIVE OWN SENT MESSAGE
  // ==========================================

  useEffect(() => {
    if (!token || !user?.id) {
      return;
    }

    const handleMessageSent = (message) => {
      console.log(
        "Sidebar message sent:",
        message
      );

      const senderId = Number(message.senderId);
      const receiverId = Number(message.receiverId);
      const currentUserId = Number(user.id);

      // ==========================================
      // ONLY HANDLE CURRENT USER'S MESSAGE
      // ==========================================

      if (senderId !== currentUserId) {
        return;
      }

      setConversations((prevConversations) => {
        const existingIndex =
          prevConversations.findIndex(
            (conversation) =>
              Number(
                conversation.otherUser?.id
              ) === receiverId
          );

        // ==========================================
        // CONVERSATION NOT FOUND
        // ==========================================

        if (existingIndex === -1) {
          fetchConversations();

          return prevConversations;
        }

        const existingConversation =
          prevConversations[existingIndex];

        const updatedConversation = {
          ...existingConversation,
          lastMessage: message.body,
          lastMessageAt: message.createdAt,
          lastMessageSenderId: message.senderId, // NEW
        };

        const updatedConversations = [
          ...prevConversations,
        ];

        // Remove old position
        updatedConversations.splice(
          existingIndex,
          1
        );

        // Move conversation to top
        updatedConversations.unshift(
          updatedConversation
        );

        return sortConversationsByLatest(
          updatedConversations
        );
      });
    };

    socket.on(
      "messageSent",
      handleMessageSent
    );

    return () => {
      socket.off(
        "messageSent",
        handleMessageSent
      );
    };
  }, [
    token,
    user?.id,
    fetchConversations,
  ]);

  // ==========================================
  // OPEN CONVERSATION
  // ==========================================

  const handleConversationClick = (
    conversation
  ) => {
    // ==========================================
    // CLEAR UNREAD COUNT
    // ==========================================

    setConversations((prevConversations) =>
      prevConversations.map((item) =>
        item.conversationId ===
        conversation.conversationId
          ? {
              ...item,
              unreadCount: 0,
            }
          : item
      )
    );

    // ==========================================
    // OPEN CHAT
    // ==========================================

    setActiveChat({
      ...conversation.otherUser,
      conversationId:
        conversation.conversationId,
    });
  };

  // ==========================================
  // SEARCH
  // ==========================================

  const filteredConversations =
    conversations.filter((conversation) =>
      conversation.otherUser?.name
        ?.toLowerCase()
        .includes(search.toLowerCase())
    );

  const totalUnreadCount = conversations.reduce(
    (sum, conversation) =>
      sum + (conversation.unreadCount || 0),
    0
  );

  useEffect(() => {
    onUnreadChange?.(totalUnreadCount);
  }, [totalUnreadCount, onUnreadChange]);

  // ==========================================
  // COLLAPSED STATE
  // ==========================================

  const fullBlock = collapsed
    ? "hidden"
    : "block";

  // ==========================================
  // CURRENT USER INITIAL
  // ==========================================

  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ||
    "U";

  // ==========================================
  // UI
  // ==========================================

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

      <div
        className={`px-3 py-3 ${fullBlock}`}
      >
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            size={16}
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search conversations"
            className="w-full pl-9 pr-3 py-2 bg-(--input-bg) border border-(--border) rounded-lg text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent"
          />
        </div>
      </div>

      {/* ==========================================
          CONVERSATION LIST
      ========================================== */}

      <div className="custom-scrollbar flex-1 overflow-y-auto px-2">
        {/* Loading */}

        {loadingConversations &&
          conversations.length === 0 && (
            <div
              className={`flex justify-center py-6 ${fullBlock}`}
            >
              <div className="w-5 h-5 border-2 border-(--border) border-t-(--accent) rounded-full animate-spin" />
            </div>
          )}

        {/* Conversations */}

        {!loadingConversations &&
          filteredConversations.map(
            (conversation) => {
              const otherUser =
                conversation.otherUser;

              if (!otherUser) {
                return null;
              }

              const userInitials = otherUser.name
                .split(" ")
                .map((name) => name[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const unreadCount =
                conversation.unreadCount || 0;

              // NEW
              const isTyping =
                !!typingUsers[Number(otherUser.id)];

              const lastFromMe =
                Number(
                  conversation.lastMessageSenderId
                ) === Number(user?.id);

              return (
                <button
                  key={
                    conversation.conversationId
                  }
                  type="button"
                  onClick={() =>
                    handleConversationClick(
                      conversation
                    )
                  }
                  title={otherUser.name}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 text-left transition ${
                    collapsed
                      ? "justify-center"
                      : "justify-center sm:justify-start"
                  } ${
                    activeChat?.conversationId ===
                    conversation.conversationId
                      ? "bg-[rgba(156,163,175,0.12)] border border-[rgba(255,255,255,0.06)]"
                      : "hover:bg-[rgba(148,163,184,0.08)]"
                  } ${
                    unreadCount > 0
                      ? "shadow-[inset_0_0_0_1px_rgba(34,197,94,0.08)]"
                      : ""
                  }`}
                >
                  {/* ==========================================
                      AVATAR
                  ========================================== */}

                  <div className="relative shrink-0">
                    {otherUser.avatarUrl ? (
                      <img
                        src={otherUser.avatarUrl}
                        alt={otherUser.name}
                        className="w-11 h-11 rounded-full object-cover border border-[rgba(255,255,255,0.09)]"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm"
                        style={{
                          backgroundColor:
                            getAvatarColor(
                              otherUser.id
                            ),
                        }}
                      >
                        {userInitials}
                      </div>
                    )}

                    {/* ==========================================
                        UNREAD BADGE ON AVATAR
                    ========================================== */}

                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#25D366] text-[#06230f] text-[10px] font-bold flex items-center justify-center border-2 border-(--panel-bg) shadow-lg">
                        {unreadCount > 99
                          ? "99+"
                          : unreadCount}
                      </span>
                    )}
                  </div>

                  {/* ==========================================
                      USER INFORMATION
                  ========================================== */}

                  <div
                    className={`flex-1 min-w-0 ${fullBlock}`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <p
                        className={`text-sm truncate ${
                          unreadCount > 0
                            ? "font-bold text-(--text-primary)"
                            : "font-medium text-(--text-primary)"
                        }`}
                      >
                        {otherUser.name}
                      </p>

                      <span className="text-[10px] text-(--text-secondary) shrink-0">
                        {formatLastMessageTime(
                          conversation.lastMessageAt
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-1 gap-2">
                      {/* NEW: typing / "You:" / preview */}
                      <p
                        className={`text-xs truncate ${
                          isTyping
                            ? "text-(--accent)"
                            : unreadCount > 0
                            ? "text-(--text-primary) font-medium"
                            : "text-(--text-secondary)"
                        }`}
                      >
                        {isTyping
                          ? "typing..."
                          : `${lastFromMe ? "You: " : ""}${
                              conversation.lastMessage ||
                              otherUser.email
                            }`}
                      </p>

                      {/* ==========================================
                          UNREAD BADGE
                      ========================================== */}

                      {unreadCount > 0 && (
                        <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-[#25D366] text-[#06230f] text-[10px] font-bold flex items-center justify-center">
                          {unreadCount > 99
                            ? "99+"
                            : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            }
          )}

        {/* ==========================================
            NO CONVERSATIONS
        ========================================== */}

        {!loadingConversations &&
          filteredConversations.length === 0 && (
            <p
              className={`text-sm text-(--text-muted) text-center py-6 ${fullBlock}`}
            >
              No conversations yet. Open Settings →
              Add Contact to start one.
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
              backgroundColor: getAvatarColor(
                user?.id
              ),
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
      </div>
    </div>
  );
}