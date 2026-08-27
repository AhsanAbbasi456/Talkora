import logo from "../../assets/images/logo.png";
import { Bell, Settings, MoreVertical, Moon, Sun } from "lucide-react";

export default function TopBar({ isLight, onToggleTheme }) {
  return (
    <header className="h-16 w-full flex items-center justify-between px-5 sm:px-7 bg-[var(--panel-bg)] border-b border-[var(--border)] shrink-0">
      <div className="flex items-center gap-3">
        <img src={logo} alt="Talkora" className="h-12 w-auto max-w-[150px] object-contain object-left" />
        <span className="hidden sm:block h-7 w-px bg-[var(--border)]" />
        <span className="hidden sm:block text-lg font-bold tracking-[0.04em] text-[var(--text-primary)] border-l-2 border-[var(--accent)] pl-3">
          Talkora
        </span>
      </div>
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <button type="button" className="rounded-lg p-2 hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition" title="Notifications">
          <Bell size={18} />
        </button>
        <button type="button" className="rounded-lg p-2 hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition" title="Settings">
          <Settings size={18} />
        </button>
        <button type="button" onClick={onToggleTheme} className="rounded-lg p-2 hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition" title={isLight ? "Switch to dark mode" : "Switch to light mode"}>
          {isLight ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button type="button" className="rounded-lg p-2 hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition" title="More options">
          <MoreVertical size={18} />
        </button>
      </div>
    </header>
  );
}