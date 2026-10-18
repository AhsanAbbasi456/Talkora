import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { LayoutDashboard, UserPlus, Users, Phone, UsersRound, CreditCard, ScrollText, ArrowLeft, ShieldCheck } from "lucide-react";
import logo from "../../assets/images/logo.png";
import Avatar from "../../utils/Avatar";
import { listen } from "../../utils/socketListen";
import useSessionSocket from "../../hooks/useSessionSocket";
import { adminApi, ROLE_LABELS } from "./adminUtils";

const NAV = [
  { to: "/admin", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/admin/requests", label: "Requests", Icon: UserPlus, badge: "requests" },
  { to: "/admin/users", label: "Users", Icon: Users },
  { to: "/admin/calls", label: "Calls", Icon: Phone },
  { to: "/admin/groups", label: "Groups", Icon: UsersRound },
  { to: "/admin/payments", label: "Payments", Icon: CreditCard, badge: "payments" },
  { to: "/admin/audit", label: "Audit log", Icon: ScrollText },
];

const prefersLight = () => !window.matchMedia("(prefers-color-scheme: dark)").matches;

// Admin pages share this frame. It also checks with the server that the
// user really is an admin; the server checks again on every request.
export default function AdminLayout() {
  const { token, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useSessionSocket(token);

  useEffect(() => {
    if (!token) return navigate("/login", { replace: true });
    adminApi("/me", token)
      .then(({ user: admin }) => setMe(admin))
      .catch((err) => setError(err.message));
  }, [token, navigate]);

  // live updates: new sign-ups and changes made by other admins
  useEffect(
    () =>
      listen({
        "admin:newRequest": refresh,
        "admin:userUpdated": refresh,
        "admin:payment": refresh,
      }),
    [refresh],
  );

  useEffect(() => {
    if (!me) return;
    adminApi("/users?status=PENDING&pageSize=1", token)
      .then(({ total }) => setPendingCount(total))
      .catch(() => {});
    adminApi("/payments?status=REVIEW", token)
      .then(({ total }) => setReviewCount(total))
      .catch(() => {});
  }, [me, token, refreshKey]);

  const themeMode = user?.themeMode || "system";
  const isLight = themeMode === "system" ? prefersLight() : themeMode === "light";
  const frame = `h-dvh bg-(--app-bg) text-(--text-primary) ${isLight ? "theme-light" : ""}`;

  if (error) {
    return (
      <div className={`${frame} flex items-center justify-center px-4`}>
        <div className="max-w-sm rounded-2xl border border-(--border) bg-(--panel-bg) p-6 text-center">
          <ShieldCheck size={28} className="mx-auto mb-3 text-(--text-muted)" />
          <p className="font-semibold">Admins only</p>
          <p className="mt-1 text-sm text-(--text-muted)">
            {error === "Admins only" ? "Your account doesn't have access to the admin page." : error}
          </p>
          <Link to="/home" className="mt-4 inline-block text-sm font-medium text-(--accent)">
            Back to chats
          </Link>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className={`${frame} flex items-center justify-center`}>
        <p className="text-sm text-(--text-muted)">Loading admin…</p>
      </div>
    );
  }

  const navItem = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
      isActive
        ? "bg-(--accent)/12 text-(--text-primary)"
        : "text-(--text-muted) hover:bg-(--border)/60 hover:text-(--text-primary)"
    }`;

  const badge = (count) =>
    count > 0 && (
      <span className="ml-auto min-w-5 rounded-full bg-(--accent) px-1.5 text-center text-[11px] font-semibold leading-5 text-[#F8FAFC]">
        {count > 99 ? "99+" : count}
      </span>
    );

  return (
    <div className={`${frame} flex flex-col md:flex-row`}>
      {/* SIDEBAR (tablet + desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-(--border) bg-(--panel-bg) md:flex">
        <div className="flex items-center gap-2 border-b border-(--border) px-4 py-4">
          <img src={logo} alt="Talkora" className="h-8 w-auto max-w-20 object-contain" />
          <span className="rounded-md border border-(--accent) px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-(--accent)">
            Admin
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Admin">
          {NAV.map(({ to, label, Icon, end, badge: hasBadge }) => (
            <NavLink key={to} to={to} end={end} className={navItem}>
              <Icon size={18} />
              {label}
              {hasBadge && badge(hasBadge === "payments" ? reviewCount : pendingCount)}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-(--border) p-3">
          <div className="mb-2 flex items-center gap-3 px-1">
            <Avatar p={me} size="w-9 h-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{me.name}</p>
              <p className="text-xs text-(--text-muted)">{ROLE_LABELS[me.role]}</p>
            </div>
          </div>
          <Link
            to="/home"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-(--text-muted) transition hover:bg-(--border)/60 hover:text-(--text-primary)"
          >
            <ArrowLeft size={16} />
            Back to chats
          </Link>
        </div>
      </aside>

      {/* TOP BAR + TABS (phone) */}
      <header className="shrink-0 border-b border-(--border) bg-(--panel-bg) md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Talkora" className="h-7 w-auto max-w-16 object-contain" />
            <span className="rounded-md border border-(--accent) px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-(--accent)">
              Admin
            </span>
          </div>
          <Link to="/home" className="flex items-center gap-1.5 text-sm text-(--text-muted)">
            <ArrowLeft size={16} />
            Chats
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin">
          {NAV.map(({ to, label, Icon, end, badge: hasBadge }) => (
            <NavLink key={to} to={to} end={end} className={navItem}>
              <Icon size={16} />
              {label}
              {hasBadge && badge(hasBadge === "payments" ? reviewCount : pendingCount)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet context={{ me, token, refreshKey, refresh }} />
        </div>
      </main>
    </div>
  );
}
