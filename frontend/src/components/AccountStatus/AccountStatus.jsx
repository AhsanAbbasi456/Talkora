import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import {
  Clock,
  XCircle,
  PauseCircle,
  Ban,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Check,
  LogIn,
} from "lucide-react";
import backgroundImage from "../../assets/images/background.png";
import { getStatusToken, clearStatusToken, fetchRequestStatus } from "../../utils/requestStatus";

const REFRESH_MS = 30 * 1000;

// What each account status looks like on this page
const VIEWS = {
  PENDING: {
    Icon: Clock,
    tone: "text-amber-300 bg-amber-400/10 border-amber-400/30",
    title: "Waiting for approval",
    body: "Your email is verified. An admin will review your account soon. This page updates by itself, and we'll also email you when you're approved.",
  },
  APPROVED: {
    Icon: CheckCircle2,
    tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30",
    title: "You're approved!",
    body: "An admin approved your account. You can log in and start chatting.",
  },
  REJECTED: {
    Icon: XCircle,
    tone: "text-red-300 bg-red-500/10 border-red-500/30",
    title: "Request not approved",
    body: "An admin did not approve your request to join Talkora.",
  },
  SUSPENDED: {
    Icon: PauseCircle,
    tone: "text-orange-300 bg-orange-500/10 border-orange-500/30",
    title: "Account suspended",
    body: "Your account is temporarily suspended.",
  },
  BANNED: {
    Icon: Ban,
    tone: "text-red-300 bg-red-500/10 border-red-500/30",
    title: "Account banned",
    body: "Your account has been banned from Talkora.",
  },
};

const when = (value) =>
  value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : null;

// Signed up -> Email verified -> Admin review -> Approved
function Timeline({ account }) {
  const approved = account.accountStatus === "APPROVED";
  const steps = [
    { label: "Account created", detail: when(account.createdAt), done: true },
    { label: "Email verified", done: true },
    {
      label: "Admin review",
      detail: approved ? "Done" : "In progress",
      done: approved,
      current: !approved,
    },
    { label: "Approved", detail: approved ? when(account.statusChangedAt) : null, done: approved },
  ];

  return (
    <ol className="mt-6 space-y-0 text-left">
      {steps.map((step, i) => (
        <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && (
            <span
              className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5 ${
                step.done ? "bg-emerald-400/60" : "bg-white/15"
              }`}
              aria-hidden="true"
            />
          )}
          <span
            className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
              step.done
                ? "border-emerald-400 bg-emerald-400 text-[#06230f]"
                : step.current
                  ? "border-amber-300 bg-amber-400/15 text-amber-300"
                  : "border-white/25 text-transparent"
            }`}
          >
            {step.done ? <Check size={14} strokeWidth={3} /> : step.current ? <Clock size={13} /> : null}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={`text-sm ${step.done || step.current ? "text-white" : "text-gray-400"}`}>
              {step.label}
              {step.current && <span className="sr-only"> (current step)</span>}
            </p>
            {step.detail && <p className="text-xs text-gray-400">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function AccountStatus() {
  const navigate = useNavigate();
  const fromLogin = useLocation().state; // what login / register already told us
  const [token] = useState(getStatusToken);
  const [account, setAccount] = useState(fromLogin);
  const [checkedAt, setCheckedAt] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    if (!token) return;
    setChecking(true);
    try {
      const data = await fetchRequestStatus(token);
      setAccount(data);
      setCheckedAt(new Date());
      setError("");
    } catch (err) {
      if (err.status === 401 || err.status === 404) clearStatusToken();
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }, [token]);

  const status = account?.accountStatus;
  // pending requests and suspensions can still change; the rest is final
  const waiting = !status || status === "PENDING" || status === "SUSPENDED";

  // live status: check right away, then every 30 seconds while waiting
  useEffect(() => {
    if (!token) return;
    const first = setTimeout(check, 0);
    return () => clearTimeout(first);
  }, [token, check]);

  useEffect(() => {
    if (!token || !waiting) return;
    const timer = setInterval(() => {
      if (!document.hidden) check();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [token, waiting, check]);

  // nothing to show: no tracking pass and not coming from login
  if (!token && !fromLogin) return <Navigate to="/login" replace />;

  const view = VIEWS[status];

  const goToLogin = () => navigate("/login", { replace: true });

  const forget = () => {
    clearStatusToken();
    goToLogin();
  };

  const until = account?.suspendedUntil ? new Date(account.suspendedUntil) : null;
  const showTimeline = account && (status === "PENDING" || status === "APPROVED") && account.createdAt;

  return (
    <div
      className="min-h-dvh flex items-center justify-center bg-cover bg-right lg:bg-center px-4 py-8"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-[#0d1233]/90 px-6 py-8 sm:px-8 text-center shadow-2xl backdrop-blur-md">
        {!view ? (
          <p className="text-sm text-gray-300">{error || "Checking your request…"}</p>
        ) : (
          <>
            <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border ${view.tone}`}>
              <view.Icon size={30} />
            </div>

            <h1 className="text-2xl font-bold text-white">{view.title}</h1>
            {account.email && (
              <p className="mt-1 text-xs text-gray-400">
                {account.name} · {account.email}
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-gray-300">{view.body}</p>

            {until && (
              <p className="mt-3 text-sm text-gray-300">
                Access returns on <span className="font-semibold text-white">{when(until)}</span>.
              </p>
            )}

            {account.reason && (
              <div className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Reason from admin</p>
                <p className="mt-1 text-gray-200">{account.reason}</p>
              </div>
            )}

            {showTimeline && <Timeline account={account} />}

            {error && <p className="mt-4 text-xs text-red-300">{error}</p>}

            {/* live-check row */}
            {token && status !== "APPROVED" && (
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400" aria-live="polite">
                <span>
                  {checking ? "Checking…" : checkedAt ? `Last checked ${checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · updates automatically` : ""}
                </span>
                <button
                  type="button"
                  onClick={check}
                  disabled={checking}
                  aria-label="Check again now"
                  className="rounded-full p-1 text-gray-300 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={goToLogin}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {status === "APPROVED" ? <LogIn size={16} /> : <ArrowLeft size={16} />}
              {status === "APPROVED" ? "Log in now" : "Back to login"}
            </button>

            {token && (
              <button
                type="button"
                onClick={forget}
                className="mt-3 text-xs text-gray-400 underline-offset-2 hover:text-gray-200 hover:underline"
              >
                Not your request? Stop tracking on this device
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
