import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STATUS_LABELS, ROLE_LABELS } from "./adminUtils";

// Status colors always come with a text label, never color alone
const STATUS_STYLES = {
  PENDING: "bg-amber-500/12 text-(--status-pending) border-amber-500/30",
  APPROVED: "bg-emerald-500/12 text-(--status-approved) border-emerald-500/30",
  REJECTED: "bg-slate-500/12 text-(--text-muted) border-slate-500/30",
  SUSPENDED: "bg-orange-500/12 text-(--status-suspended) border-orange-500/30",
  BANNED: "bg-red-500/12 text-(--status-banned) border-red-500/30",
};

const STATUS_DOTS = {
  PENDING: "bg-amber-500",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-slate-400",
  SUSPENDED: "bg-orange-500",
  BANNED: "bg-red-500",
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status] || ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status] || "bg-slate-400"}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function RoleBadge({ role }) {
  if (role === "USER") return <span className="text-xs text-(--text-muted)">User</span>;
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full border border-(--accent) px-2 py-0.5 text-[11px] font-semibold text-(--accent)"
    >
      {ROLE_LABELS[role] || role}
    </span>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-(--text-primary) sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-(--text-muted)">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-(--border) bg-(--panel-bg) ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-(--border) px-4 py-3">
          <h2 className="text-sm font-semibold text-(--text-primary)">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// With `to`, the whole tile is a link to the matching list
export function StatTile({ label, value, hint, Icon, to }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-(--text-muted)">{label}</p>
        {Icon && <Icon size={16} className="text-(--text-muted)" />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-(--text-primary)">{value}</p>
      {hint && (
        <p className="mt-1 flex items-center justify-between gap-1 text-xs text-(--text-muted)">
          {hint}
          {to && <ChevronRight size={14} className="shrink-0 opacity-0 transition group-hover:opacity-100" />}
        </p>
      )}
    </>
  );

  const box = "rounded-2xl border border-(--border) bg-(--panel-bg) p-4";
  return to ? (
    <Link
      to={to}
      className={`${box} group block transition hover:border-(--accent) focus-visible:outline-2 focus-visible:outline-(--accent)`}
    >
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

export function EmptyState({ Icon, title, text }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-(--border) bg-(--app-bg)">
          <Icon size={22} className="text-(--text-muted)" />
        </div>
      )}
      <p className="text-sm font-medium text-(--text-primary)">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs text-(--text-muted)">{text}</p>}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-(--border) text-(--text-primary) hover:bg-(--border) disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-(--border) px-4 py-3 text-xs text-(--text-muted)">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function ErrorNote({ text }) {
  if (!text) return null;
  return (
    <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{text}</p>
  );
}
