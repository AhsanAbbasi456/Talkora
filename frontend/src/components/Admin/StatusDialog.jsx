import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { buttonStyles } from "./adminUtils";

const COPY = {
  APPROVED: {
    title: "Approve",
    text: "They can log in and use Talkora right away. We'll email them.",
    button: "Approve",
    style: buttonStyles.primary,
  },
  REJECTED: {
    title: "Reject request",
    text: "They won't be able to log in. They'll see the reason on the login page.",
    button: "Reject",
    style: buttonStyles.danger,
    reason: true,
  },
  SUSPENDED: {
    title: "Suspend",
    text: "They are logged out everywhere and can't log in until the suspension ends.",
    button: "Suspend",
    style: buttonStyles.danger,
    reason: true,
    days: true,
  },
  BANNED: {
    title: "Ban",
    text: "They are logged out everywhere and can't log in again until an admin restores them.",
    button: "Ban",
    style: buttonStyles.danger,
    reason: true,
  },
};

const DURATIONS = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Until restored", days: null },
];

// Confirms one status change for one or more users.
// onConfirm({ status, reason, days }) should return a promise.
export default function StatusDialog({ status, names, onConfirm, onClose }) {
  const copy = COPY[status];
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onConfirm({
        status,
        reason: copy.reason ? reason : undefined,
        days: copy.days ? days : undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong");
      setBusy(false);
    }
  };

  const who = names.length === 1 ? names[0] : `${names.length} users`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={`${copy.title} ${who}`}
        className="w-full max-w-md rounded-t-2xl border border-(--border) bg-(--panel-bg) p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-(--text-primary)">
            {copy.title} {who}?
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-lg p-1 text-(--text-muted) hover:bg-(--border)"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-(--text-muted)">{copy.text}</p>

        {copy.days && (
          <fieldset className="mt-4">
            <legend className="mb-2 text-xs font-medium text-(--text-muted)">How long</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setDays(d.days)}
                  aria-pressed={days === d.days}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                    days === d.days
                      ? "border-(--accent) bg-(--accent)/10 text-(--text-primary)"
                      : "border-(--border) text-(--text-muted) hover:text-(--text-primary)"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {copy.reason && (
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-medium text-(--text-muted)">
              Reason (optional, the user will see it)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full resize-none rounded-lg border border-(--border) bg-(--input-bg) px-3 py-2 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-(--accent) focus:outline-none"
              placeholder="e.g. Spam messages"
            />
          </label>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={buttonStyles.ghost}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={copy.style}>
            {busy ? "Saving..." : copy.button}
          </button>
        </div>
      </form>
    </div>
  );
}
