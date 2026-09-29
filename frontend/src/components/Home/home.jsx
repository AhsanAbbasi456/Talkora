import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import TopBar from "../TopBar/TopBar";
import Sidebar from "../Sidebar/Sidebar";
import SettingsModal from "../Sidebar/SettingsModal";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatDetails from "../ChatDetail/ChatDetail";
import Loader from "../Loader/Loader";

const API_BASE_URL = "http://localhost:3000/api";

function getSystemPrefersLight() {
  return !window.matchMedia("(prefers-color-scheme: dark)").matches;
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

  useEffect(() => {
    if (themeMode !== "system") {
      setIsLight(themeMode === "light");
      return;
    }

    setIsLight(getSystemPrefersLight());

    const mql = window.matchMedia("(prefers-color-scheme: dark)");

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

    if (!token) return;

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
  // ESCAPE KEY
  // ==========================================

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && activeChat && !settingsOpen) {
        closeChat();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeChat, settingsOpen]);

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  const handleSend = async (text) => {
    if (!activeChat?.id || !token || !text.trim()) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId: activeChat.id,
          body: text.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to send message:", data);

        return null;
      }

      // Backend returns the actual saved message
      // We return it to ChatWindow so it can
      // immediately add it to its messages state.
      return data.data;
    } catch (error) {
      console.error("Send message error:", error);

      return null;
    }
  };

  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden bg-(--app-bg) ${
        isLight ? "theme-light" : ""
      }`}
    >
      <Loader />

      <TopBar
        onToggleSidebar={() => setCollapsed((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ==========================================
            SIDEBAR
        ========================================== */}

        <div className={mobileOpen ? "hidden md:block" : "block"}>
          <Sidebar
            activeChat={activeChat}
            setActiveChat={handleSelectChat}
            collapsed={collapsed}
            refreshKey={refreshKey}
          />
        </div>

        {/* ==========================================
            CHAT WINDOW
        ========================================== */}

        <div
          className={`flex-1 min-w-0 ${
            mobileOpen ? "flex" : "hidden md:flex"
          }`}
        >
          <ChatWindow
            key={activeChat?.id || "empty"}
            activeChat={activeChat}
            onSend={handleSend}
            onShowDetails={() => setShowDetails(true)}
            onBack={closeChat}
          />
        </div>

        {/* ==========================================
            CHAT DETAILS
        ========================================== */}

        {showDetails && (
          <ChatDetails
            activeChat={activeChat}
            onClose={() => setShowDetails(false)}
          />
        )}
      </div>

      {/* ==========================================
          SETTINGS
      ========================================== */}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onContactAdded={(chat) => {
          handleSelectChat(chat);
          setRefreshKey((k) => k + 1);
          setSettingsOpen(false);
        }}
        themeMode={themeMode}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
}