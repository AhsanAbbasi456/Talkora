import { useState } from "react";
import TopBar from "../TopBar/TopBar";
import Sidebar from "../Sidebar/Sidebar";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatDetails from "../ChatDetail/ChatDetail";

export default function Home() {
  const [activeChat, setActiveChat] = useState({
    name: "Sarah Khan",
    online: true,
    avatarColor: "#3B82F6",
  });
  const [showDetails, setShowDetails] = useState(false);
  const [isLight, setIsLight] = useState(false);

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden bg-[var(--app-bg)] ${isLight ? "theme-light" : ""}`}>
      {/* Top title bar with logo */}
      <TopBar isLight={isLight} onToggleTheme={() => setIsLight((current) => !current)} />

      {/* Main 3-panel layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: contact list */}
        <div className="w-[320px] shrink-0">
          <Sidebar activeChat={activeChat} setActiveChat={setActiveChat} />
        </div>

        {/* Middle: active conversation */}
        <ChatWindow
          activeChat={activeChat}
          onShowDetails={() => setShowDetails(true)}
        />

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