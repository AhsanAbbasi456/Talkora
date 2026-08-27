import { useEffect, useState } from "react";
import TopBar from "../TopBar/TopBar";
import Sidebar from "../Sidebar/Sidebar";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatDetails from "../ChatDetail/ChatDetail";

export default function Home() {
  const [activeChat, setActiveChat] = useState(null);

  const [showDetails, setShowDetails] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false); // true = chat window takes over the screen on mobile

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    setMobileOpen(true);
  };

  const closeChat = () => {
    setActiveChat(null);
    setMobileOpen(false);
    setShowDetails(false);
  };

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && activeChat) closeChat();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeChat]);

  const handleSend = (text) => {
    setActiveChat((chat) => ({
      ...chat,
      messages: [
        ...chat.messages,
        {
          id: chat.messages.length + 1,
          text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isOwn: true,
        },
      ],
    }));
  };

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden bg-[var(--app-bg)] ${isLight ? "theme-light" : ""}`}>
      <TopBar
        isLight={isLight}
        onToggleTheme={() => setIsLight((v) => !v)}
        onToggleSidebar={() => setCollapsed((v) => !v)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: contact list — hidden on mobile once a chat is open */}
        <div className={`w-full md:w-auto shrink-0 ${mobileOpen ? "hidden md:block" : "block"}`}>
          <Sidebar
            activeChat={activeChat}
            setActiveChat={handleSelectChat}
            collapsed={collapsed}
          />
        </div>

        {/* Middle: active conversation — full-screen on mobile once opened */}
        <div className={`flex-1 min-w-0 ${mobileOpen ? "flex" : "hidden md:flex"}`}>
          <ChatWindow
            key={activeChat?.id || "empty"}
            activeChat={activeChat}
            onSend={handleSend}
            onShowDetails={() => setShowDetails(true)}
            onBack={closeChat}
          />
        </div>

        {/* Right: chat details panel */}
        {showDetails && (
          <ChatDetails
            activeChat={activeChat}
            onClose={() => setShowDetails(false)}
          />
        )}
      </div>
    </div>
  );
}