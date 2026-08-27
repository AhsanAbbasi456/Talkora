import logo from "../../assets/images/logo.png";
import { Bell, Settings, MoreVertical, Moon, Sun, PanelLeft } from "lucide-react";

export default function TopBar({ isLight, onToggleTheme, onToggleSidebar }) {
  return (
    <header className="h-12 w-full flex items-center justify-between px-2 sm:px-4 bg-[var(--panel-bg)] border-b border-[var(--border)] shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition shrink-0"
          title="Toggle sidebar"
        >
          <PanelLeft size={18} />
        </button>
        <img src={logo} alt="Talkora" className="h-8 w-auto max-w-[96px] object-contain object-left shrink-0" />
        <span className="h-5 w-px bg-[var(--border)]" />
        <span className="text-sm font-bold tracking-[0.04em] text-[var(--text-primary)] border-l-2 border-[var(--accent)] pl-2 truncate">
          Talkora
        </span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 text-[var(--text-muted)] shrink-0">
        <button type="button" className="hidden sm:block rounded-lg p-2 hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition" title="Notifications">
          <Bell size={18} />
        </button>
        <button type="button" className="hidden sm:block rounded-lg p-2 hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition" title="Settings">
          <Settings size={18} />
        </button>
        <button type="button" onClick={onToggleTheme} className="rounded-lg p-2 hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition" title={isLight ? "Switch to dark mode" : "Switch to light mode"}>
          {isLight ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button type="button" className="hidden sm:block rounded-lg p-2 hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition" title="More options">
          <MoreVertical size={18} />
        </button>
      </div>
    </header>
  );
}