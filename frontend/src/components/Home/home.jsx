import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import socket from "../../socket";
import { listen } from "../../utils/socketListen";
import TopBar from "../TopBar/TopBar";
import Sidebar from "../Sidebar/Sidebar";
import SettingsModal from "../Sidebar/SettingsModal";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatDetails from "../ChatDetail/ChatDetail";
import GroupInfo from "../GroupInfo/GroupInfo";
import Loader from "../Loader/Loader";
import { getAvatarColor } from "../../utils/avatarColor";
import useSessionSocket from "../../hooks/useSessionSocket";
import { fetchPlan } from "../../redux/planSlice";
import UpgradeModal from "../Plus/UpgradeModal";

const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3002"}/api`;

const prefersLight = () => !window.matchMedia("(prefers-color-scheme: dark)").matches;

const getInitials = (name = "") =>
  name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

function IncomingToast({ toast }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-center gap-3 rounded-2xl border border-(--border) bg-(--panel-bg) p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#F8FAFC]"
          style={{ backgroundColor: getAvatarColor(toast.senderId) }}
        >
          {toast.initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold text-(--text-primary)">{toast.senderName}</span>
            <span className="text-[10px] text-(--text-muted)">
              {new Date(toast.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="truncate text-sm text-(--text-secondary)">{toast.body}</p>
        </div>

        <div className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-[#06230f]">
          {toast.count > 99 ? "99+" : toast.count}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, token } = useSelector((state) => state.auth);

  const [activeChat, setActiveChat] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [themeMode, setThemeMode] = useState(user?.themeMode || "system");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [incomingToast, setIncomingToast] = useState(null);
  const [isLight, setIsLight] = useState(() => (themeMode === "system" ? prefersLight() : themeMode === "light"));

  const incomingToastRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  const refreshSidebar = () => setRefreshKey((value) => value + 1);

  const closeChat = () => {
    setActiveChat(null);
    setMobileOpen(false);
    setShowDetails(false);
  };

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    setMobileOpen(true);
  };

  // ---------- incoming message toast ----------
  const showIncomingMessageToast = (message, count = 1) => {
    const senderId = Number(message?.senderId);
    const directOpen = activeChat && activeChat.type !== "GROUP" && Number(activeChat.id) === senderId;
    const member =
      activeChat?.type === "GROUP"
        ? activeChat.members?.find((m) => Number(m.userId) === senderId)
        : null;

    const senderName =
      message?.senderName ||
      (directOpen ? activeChat.name || activeChat.otherUser?.name : null) ||
      member?.user?.name ||
      "New message";

    const body = (typeof message?.body === "string" && message.body.trim()) || "New message";

    const groupOpen =
      activeChat?.type === "GROUP" &&
      Number(activeChat.conversationId) === Number(message?.conversationId);
    const isGroupMessage = message?.conversationType === "GROUP" || groupOpen;

    const title = isGroupMessage
      ? message?.conversationName || (groupOpen ? activeChat.name : null) || "Group message"
      : senderName;
    const text = isGroupMessage && senderName !== title ? `${senderName}: ${body}` : body;

    clearTimeout(incomingToastRef.current);

    setIncomingToast({
      id: Date.now() + Math.random(),
      senderId,
      senderName: title,
      body: text,
      createdAt: message?.createdAt || new Date().toISOString(),
      count: Number(count) > 0 ? Number(count) : 1,
      initials: getInitials(senderName),
    });

    incomingToastRef.current = setTimeout(() => {
      setIncomingToast(null);
      if (document.title.includes("New message")) document.title = originalTitleRef.current;
    }, 5000);

    if (document.visibilityState !== "visible") {
      document.title = `New message • ${originalTitleRef.current}`;
    }

  }

  // ---------- incoming + offline messages ----------
  useEffect(() => {
    const isOpenChat = (senderId, conversationId) =>
      document.visibilityState === "visible" &&
      (activeChat?.type === "GROUP"
        ? Number(activeChat.conversationId) === Number(conversationId)
        : Number(activeChat?.id) === Number(senderId));

    const onMessage = (message, count = 1) => {
      refreshSidebar();
      if (!isOpenChat(message?.senderId, message?.conversationId)) {
        showIncomingMessageToast(message, count);
      }
    };

    return listen({
      newMessage: (message) => onMessage(message),
      offlineMessageNotification: (payload) => onMessage(payload, payload?.count || 1),
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeChat?.id,
    activeChat?.type,
    activeChat?.conversationId,
    activeChat?.name,
    activeChat?.otherUser?.name,
  ]);

  // refresh the sidebar when my message is saved
  useEffect(() => listen({ messageSent: refreshSidebar }), []);

  // ---------- group live updates ----------
  const applyGroup = (group) => {
    setActiveChat((chat) =>
      chat?.conversationId === group.conversationId
        ? { ...chat, ...group, id: group.conversationId }
        : chat
    );
    refreshSidebar();
  };

  useEffect(
    () =>
      listen({
        groupUpdated: applyGroup,
        addedToGroup: refreshSidebar,
        removedFromGroup: ({ conversationId }) => {
          setActiveChat((chat) => (chat?.conversationId === conversationId ? null : chat));
          setShowDetails(false);
          refreshSidebar();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // no chat open -> back to the chat list on mobile
  useEffect(() => {
    if (!activeChat) setMobileOpen(false);
  }, [activeChat]);

  // ---------- socket connection (+ live suspend / logout from admins) ----------
  useSessionSocket(token);

  // ---------- plan (Free / Plus), refreshed live after a payment ----------
  const dispatch = useDispatch();
  useEffect(() => {
    if (!token) return;
    dispatch(fetchPlan(token));
    return listen({ planUpdated: () => dispatch(fetchPlan(token)) });
  }, [token, dispatch]);

  // ---------- theme ----------
  useEffect(() => {
    if (user?.themeMode) setThemeMode(user.themeMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (themeMode !== "system") {
      setIsLight(themeMode === "light");
      return;
    }

    setIsLight(prefersLight());

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setIsLight(prefersLight());

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [themeMode]);

  const handleThemeChange = async (mode) => {
    setThemeMode(mode);
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ themeMode: mode }),
      });
    } catch (error) {
      console.error("Failed to save theme to your account:", error);
    }
  };

  // ---------- sending ----------
  const emitIfReady = (event, payload) => {
    if (!token || !socket.connected) {
      return console.error("Cannot emit socket event: not connected");
    }
    socket.emit(event, payload);
  };

  const handleSend = (text) => {
    const body = text?.trim();
    if (!activeChat || !body) return;

    const target =
      activeChat.type === "GROUP"
        ? { conversationId: Number(activeChat.conversationId) }
        : { receiverId: Number(activeChat.id) };

    if (!Number.isInteger(Object.values(target)[0])) {
      return console.error("Chat id is missing or invalid:", activeChat);
    }

    emitIfReady("sendMessage", { ...target, body });
  };

  const handleDeleteChat = (mode) => {
    if (activeChat?.type !== "GROUP" && activeChat?.id) {
      emitIfReady("deleteChat", { userId: activeChat.id, mode });
    }
  };

  // ---------- chat deleted ----------
  useEffect(
    () =>
      listen({
        chatDeleted: ({ userId, mode }) => {
          if (userId && activeChat?.id && Number(userId) === Number(activeChat.id)) {
            if (mode === "delete") closeChat();
            else socket.emit("getMessages", { userId: activeChat.id });
          }
          refreshSidebar();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeChat?.id, token]
  );

  // ---------- Escape closes the chat ----------
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && activeChat && !settingsOpen) closeChat();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeChat, settingsOpen]);

  return (
    <div className={`h-dvh w-full flex flex-col overflow-hidden bg-(--app-bg) ${isLight ? "theme-light" : ""}`}>
      <Loader />

      <TopBar
        onToggleSidebar={() => setCollapsed((value) => !value)}
        onOpenSettings={() => setSettingsOpen(true)}
        totalUnreadCount={totalUnreadCount}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className={mobileOpen ? "hidden md:block" : "block w-full md:w-auto"}>
          <Sidebar
            activeChat={activeChat}
            setActiveChat={handleSelectChat}
            collapsed={collapsed}
            refreshKey={refreshKey}
            onUnreadChange={setTotalUnreadCount}
          />
        </div>

        <div className={`flex-1 min-w-0 ${mobileOpen ? "flex" : "hidden md:flex"}`}>
          <ChatWindow
            key={activeChat?.conversationId || activeChat?.id || "empty"}
            activeChat={activeChat}
            onSend={handleSend}
            onShowDetails={() => setShowDetails(true)}
            onBack={closeChat}
          />
        </div>

        {showDetails &&
          (activeChat?.type === "GROUP" ? (
            <GroupInfo chat={activeChat} onClose={() => setShowDetails(false)} onUpdate={applyGroup} />
          ) : (
            <ChatDetails
              activeChat={activeChat}
              onClose={() => setShowDetails(false)}
              onDeleteChat={handleDeleteChat}
            />
          ))}
      </div>

      {incomingToast && <IncomingToast toast={incomingToast} />}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onContactAdded={(chat) => {
          handleSelectChat(chat);
          refreshSidebar();
          setSettingsOpen(false);
        }}
        onGroupCreated={(group) => {
          handleSelectChat({
            id: group.conversationId,
            conversationId: group.conversationId,
            type: "GROUP",
            name: group.name,
            description: group.description,
            avatarUrl: group.avatarUrl,
            createdBy: group.createdBy,
            members: group.members,
          });
          refreshSidebar();
          setSettingsOpen(false);
        }}
        themeMode={themeMode}
        onThemeChange={handleThemeChange}
      />
      <UpgradeModal />
    </div>
  );
}