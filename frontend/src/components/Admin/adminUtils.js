import { api } from "../../utils/api";

// Calls /api/admin/... with the login token
export const adminApi = (path, token, method, body) => api(`/admin${path}`, token, method, body);

export const isAdminRole = (role) => role === "ADMIN";

export const STATUS_LABELS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
};

export const ROLE_LABELS = { USER: "User", ADMIN: "Admin" };

export const MESSAGE_TYPE_LABELS = {
  TEXT: "Text",
  IMAGE: "Photos",
  VIDEO: "Videos",
  AUDIO: "Voice notes",
  DOCUMENT: "Documents",
  POLL: "Polls",
  CALL: "Call logs",
};

// Audit log action -> readable sentence ("approved", "suspended" ...)
export const ACTION_LABELS = {
  USER_APPROVED: "approved",
  USER_REJECTED: "rejected",
  USER_SUSPENDED: "suspended",
  USER_BANNED: "banned",
  ROLE_CHANGED: "changed the role of",
  FORCE_LOGOUT: "signed out",
  PLUS_GRANTED: "gave Plus to",
  PLUS_REVOKED: "ended Plus for",
  PAYMENT_APPROVED: "approved the transfer of",
  PAYMENT_REJECTED: "rejected the transfer of",
};

export const CALL_STATUS_LABELS = {
  completed: "Answered",
  missed: "Missed",
  declined: "Declined",
  busy: "Busy",
  cancelled: "Cancelled",
  failed: "Failed",
  ongoing: "In progress",
  ringing: "Ringing",
  calling: "Calling",
};

// 75 -> "1:15", 3725 -> "1:02:05"
export const formatDuration = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

// 7260 -> "2 h 1 min", 90 -> "2 min", 20 -> "20 s"
export const formatTotalTime = (seconds = 0) => {
  if (seconds < 60) return `${seconds} s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};

export const formatNumber = (n = 0) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    : n >= 10_000
      ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`
      : n.toLocaleString();

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString([], { dateStyle: "medium" }) : "—";

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "—";

export const timeAgo = (value) => {
  if (!value) return "—";
  const s = Math.round((Date.now() - new Date(value)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return formatDate(value);
};

// Mirrors the backend rule: admins can change any account except their own
export const canManage = (me, target) => Boolean(me && target) && me.id !== target.id;

// Shared button looks for the admin pages
export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-(--accent) px-3 py-2 text-sm font-medium text-[#F8FAFC] transition hover:opacity-90 disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-(--border) px-3 py-2 text-sm font-medium text-(--text-primary) transition hover:bg-(--border) disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50",
};
