import { useEffect, useRef, useState } from "react";
import socket from "../../socket";
import { useSelector } from "react-redux";
import TopBar from "../TopBar/TopBar";
import Sidebar from "../Sidebar/Sidebar";
import SettingsModal from "../Sidebar/SettingsModal";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatDetails from "../ChatDetail/ChatDetail";
import Loader from "../Loader/Loader";
import { getAvatarColor } from "../../utils/avatarColor"; // NEW

const API_BASE_URL = "http://localhost:3000/api";

function getSystemPrefersLight() {
  return !window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function Home() {
  const { user, token } = useSelector((state) => state.auth);

  const [activeChat, setActiveChat] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [themeMode, setThemeMode] = useState(
    user?.themeMode || "system"
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [incomingToast, setIncomingToast] = useState(null);
  const incomingToastRef = useRef(null);
  const originalDocumentTitleRef = useRef(document.title);

  // ==========================================
  // INCOMING MESSAGE NOTIFICATION
  // ==========================================

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const showIncomingMessageToast = (message, count = 1) => {
    const senderId = Number(message?.senderId);
    const senderName =
      message?.senderName ||
      (activeChat && Number(activeChat.id) === senderId
        ? activeChat.name || activeChat.otherUser?.name || "New message"
        : "New message");

    const trimmedBody =
      typeof message?.body === "string"
        ? message.body.trim()
        : "";

    const nextToast = {
      id: Date.now() + Math.random(),
      senderId, // NEW: used for the avatar color
      senderName,
      body: trimmedBody || "New message",
      createdAt: message?.createdAt || new Date().toISOString(),
      count: Number.isFinite(Number(count)) && Number(count) > 0 ? Number(count) : 1,
      initials: senderName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    };

    clearTimeout(incomingToastRef.current);
    setIncomingToast(nextToast);
    incomingToastRef.current = setTimeout(() => {
      setIncomingToast(null);
      if (document.title.includes("New message")) {
        document.title = originalDocumentTitleRef.current;
      }
    }, 5000);

    if (document.visibilityState !== "visible") {
      document.title = `New message • ${originalDocumentTitleRef.current}`;
    }

    if ("Notification" in window && Notification.permission === "granted") {
      const browserNotification = new Notification(senderName, {
        body: trimmedBody || "New message",
        tag: `talkora-message-${message?.id || senderId}`,
      });

      setTimeout(() => browserNotification.close(), 5000);
    }
  };

  useEffect(() => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      requestNotificationPermission();
    }
  }, []);

  useEffect(() => {
    const handleNewMessage = (message) => {
      console.log("Incoming socket message:", message);
      setRefreshKey((value) => value + 1);

      if (document.visibilityState === "visible" && activeChat?.id === message?.senderId) {
        return;
      }

      showIncomingMessageToast(message);
    };

    const handleOfflineNotification = (payload) => {
      const message = {
        id: payload?.id,
        senderId: payload?.senderId,
        receiverId: payload?.receiverId,
        senderName: payload?.senderName,
        body: payload?.body,
        createdAt: payload?.createdAt,
      };

      if (document.visibilityState === "visible" && activeChat?.id === payload?.senderId) {
        return;
      }

      showIncomingMessageToast(message, payload?.count || 1);
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("offlineMessageNotification", handleOfflineNotification);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("offlineMessageNotification", handleOfflineNotification);
    };
  }, [activeChat?.id, activeChat?.name, activeChat?.otherUser?.name]);

  // ==========================================
  // SOCKET CONNECTION
  // ==========================================

  useEffect(() => {
    if (!token) {
      socket.disconnect();
      return;
    }

    if (socket.connected) {
      socket.disconnect();
    }

    socket.auth = {
      token: token,
    };

    const handleConnect = () => {
      console.log("Socket connected:", socket.id);
    };

    const handleConnectError = (error) => {
      console.error(
        "Socket connection error:",
        error.message
      );
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);

      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [token]);

  // ==========================================
  // MESSAGE SENT
  // ==========================================

  useEffect(() => {
    const handleMessageSent = (message) => {
      console.log("Message sent successfully:", message);
      setRefreshKey((value) => value + 1);
    };

    socket.on("messageSent", handleMessageSent);

    return () => {
      socket.off("messageSent", handleMessageSent);
    };
  }, []);

  // ==========================================
  // LOAD USER THEME
  // ==========================================

  useEffect(() => {
    if (user?.themeMode) {
      setThemeMode(user.themeMode);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [isLight, setIsLight] = useState(() =>
    themeMode === "system"
      ? getSystemPrefersLight()
      : themeMode === "light"
  );

  // ==========================================
  // THEME MODE
  // ==========================================

  useEffect(() => {
    if (themeMode !== "system") {
      setIsLight(themeMode === "light");
      return;
    }

    setIsLight(getSystemPrefersLight());

    const mql = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const handleChange = () => {
      setIsLight(getSystemPrefersLight());
    };

    mql.addEventListener("change", handleChange);

    return () => {
      mql.removeEventListener("change", handleChange);
    };
  }, [themeMode]);

  // ==========================================
  // THEME CHANGE
  // ==========================================

  const handleThemeChange = async (mode) => {
    setThemeMode(mode);

    if (!token) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          themeMode: mode,
        }),
      });
    } catch (error) {
      console.error(
        "Failed to save theme to your account:",
        error
      );
    }
  };

  // ==========================================
  // SELECT CHAT
  // ==========================================

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    setMobileOpen(true);
  };

  // ==========================================
  // CLOSE CHAT
  // ==========================================

  const closeChat = () => {
    setActiveChat(null);
    setMobileOpen(false);
    setShowDetails(false);
  };

  // ==========================================
  // DELETE / CLEAR CHAT
  // ==========================================

  const handleDeleteChat = (mode) => {
    if (!activeChat?.id || !token) {
      return;
    }

    if (!socket.connected) {
      console.error("Socket is not connected");
      return;
    }

    socket.emit("deleteChat", {
      userId: activeChat.id,
      mode,
    });
  };

  useEffect(() => {
    const handleChatDeleted = ({ userId, mode }) => {
      if (!userId || !activeChat?.id) {
        setRefreshKey((value) => value + 1);
        return;
      }

      const isCurrentChat = Number(userId) === Number(activeChat.id);

      if (isCurrentChat) {
        if (mode === "delete") {
          closeChat();
        } else {
          socket.emit("getMessages", {
            userId: activeChat.id,
          });
        }
      }

      setRefreshKey((value) => value + 1);
    };

    socket.on("chatDeleted", handleChatDeleted);

    return () => {
      socket.off("chatDeleted", handleChatDeleted);
    };
  }, [activeChat?.id, token]);

  // ==========================================
  // ESCAPE KEY
  // ==========================================

  useEffect(() => {
    const handleEscape = (event) => {
      if (
        event.key === "Escape" &&
        activeChat &&
        !settingsOpen
      ) {
        closeChat();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [activeChat, settingsOpen]);

  // ==========================================
  // SEND MESSAGE THROUGH SOCKET.IO
  // ==========================================

  const handleSend = (text) => {
    if (
      !activeChat?.id ||
      !token ||
      !text.trim()
    ) {
      return;
    }

    if (!socket.connected) {
      console.error("Socket is not connected");
      return;
    }

    socket.emit("sendMessage", {
      receiverId: activeChat.id,
      body: text.trim(),
    });
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden bg-(--app-bg) ${
        isLight ? "theme-light" : ""
      }`}
    >
      <Loader />

      <TopBar
        onToggleSidebar={() =>
          setCollapsed((value) => !value)
        }
        onOpenSettings={() =>
          setSettingsOpen(true)
        }
        totalUnreadCount={totalUnreadCount}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ==========================================
            SIDEBAR
        ========================================== */}

        <div
          className={
            mobileOpen
              ? "hidden md:block"
              : "block"
          }
        >
          <Sidebar
            activeChat={activeChat}
            setActiveChat={handleSelectChat}
            collapsed={collapsed}
            refreshKey={refreshKey}
            onUnreadChange={setTotalUnreadCount}
          />
        </div>

        {/* ==========================================
            CHAT WINDOW
        ========================================== */}

        <div
          className={`flex-1 min-w-0 ${
            mobileOpen
              ? "flex"
              : "hidden md:flex"
          }`}
        >
          <ChatWindow
            key={activeChat?.id || "empty"}
            activeChat={activeChat}
            onSend={handleSend}
            onShowDetails={() =>
              setShowDetails(true)
            }
            onBack={closeChat}
          />
        </div>

        {/* ==========================================
            CHAT DETAILS
        ========================================== */}

        {showDetails && (
          <ChatDetails
            activeChat={activeChat}
            onClose={() =>
              setShowDetails(false)
            }
            onDeleteChat={handleDeleteChat}
          />
        )}
      </div>

      {/* ==========================================
          INCOMING MESSAGE TOAST (theme-aware)
      ========================================== */}

      {incomingToast && (
        <div className="pointer-events-none fixed right-4 top-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-3 rounded-2xl border border-(--border) bg-(--panel-bg) p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#F8FAFC]"
              style={{
                backgroundColor: getAvatarColor(incomingToast.senderId),
              }}
            >
              {incomingToast.initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-(--text-primary)">
                  {incomingToast.senderName}
                </span>
                <span className="text-[10px] text-(--text-muted)">
                  {new Date(incomingToast.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <p className="truncate text-sm text-(--text-secondary)">
                {incomingToast.body}
              </p>
            </div>

            <div className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-[#06230f]">
              {incomingToast.count > 99 ? "99+" : incomingToast.count}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SETTINGS
      ========================================== */}

      <SettingsModal
        open={settingsOpen}
        onClose={() =>
          setSettingsOpen(false)
        }
        onContactAdded={(chat) => {
          handleSelectChat(chat);
          setRefreshKey((key) => key + 1);
          setSettingsOpen(false);
        }}
        themeMode={themeMode}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
}