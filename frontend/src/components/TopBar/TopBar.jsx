import logo from "../../assets/images/logo.png";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Bell, Settings, PanelLeft, ShieldCheck, Sparkles } from "lucide-react";

export default function TopBar({
  onToggleSidebar,
  onOpenSettings,
  totalUnreadCount = 0,
}) {
  const role = useSelector((state) => state.auth.user?.role);
  const isAdmin = role === "ADMIN";
  const { loaded: planLoaded, isPlus } = useSelector((state) => state.plan);

  return (
    <header className="h-12 w-full flex items-center justify-between px-2 sm:px-4 bg-(--panel-bg) border-b border-(--border) shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-(--text-muted) hover:bg-(--border) hover:text-(--text-primary) transition shrink-0"
          style={{ cursor: "ew-resize" }}
        >
          <PanelLeft size={18} />
        </button>

        <img
          src={logo}
          alt="Talkora"
          className="h-8 w-auto max-w-24 object-contain object-left shrink-0"
        />

        <span className="h-5 w-px bg-(--border)" />

        <span className="text-sm font-bold tracking-[0.04em] text-(--text-primary) border-l-2 border-(--accent) pl-2 truncate">
          Talkora
        </span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 text-(--text-muted) shrink-0">
        {planLoaded && (
          <Link
            to={isPlus ? "/billing" : "/upgrade"}
            title={isPlus ? "Talkora Plus · billing" : "Upgrade to Talkora Plus"}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              isPlus
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                : "border border-orange-400/60 text-orange-500 hover:bg-orange-500/10"
            }`}
          >
            <Sparkles size={14} />
            <span className={isPlus ? "" : "hidden sm:inline"}>{isPlus ? "Plus" : "Upgrade"}</span>
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-(--accent) hover:bg-(--border) transition"
            title="Admin page"
          >
            <ShieldCheck size={18} />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
        <button
          type="button"
          className="hidden sm:block relative rounded-lg p-2 hover:bg-(--border) hover:text-(--text-primary) transition"
          title="Notifications"
        >
          <Bell size={18} />
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#25D366] text-[9px] font-bold text-[#06230f] flex items-center justify-center border border-(--panel-bg)">
              {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="hidden sm:block rounded-lg p-2 hover:bg-(--border) hover:text-(--text-primary) transition"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}