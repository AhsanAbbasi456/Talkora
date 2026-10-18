import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, ZoomIn } from "lucide-react";
import Avatar from "../../utils/Avatar";
import { API_BASE_URL } from "../../utils/api";
import { adminApi, buttonStyles, timeAgo, formatDateTime } from "./adminUtils";
import { formatPkr, METHOD_LABELS } from "../Plus/plusInfo";

// One transfer waiting for an admin: screenshot + details + Approve / Reject.
// Before approving, check the TID and amount in YOUR bank / wallet app.
export default function PaymentReviewCard({ order, token, onDone }) {
  const [proofUrl, setProofUrl] = useState(null);
  const [zoom, setZoom] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // the screenshot is private, so it is fetched with the admin's login token
  useEffect(() => {
    let url;
    let cancelled = false;
    fetch(`${API_BASE_URL}/admin/payments/${order.id}/proof`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setProofUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [order.id, token]);

  const act = async (path, body) => {
    setBusy(true);
    setError("");
    try {
      await adminApi(`/payments/${order.id}/${path}`, token, "POST", body);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row">
      <button
        type="button"
        onClick={() => proofUrl && setZoom(true)}
        className="group relative h-40 w-full shrink-0 overflow-hidden rounded-lg border border-(--border) bg-(--app-bg) sm:h-36 sm:w-28"
        aria-label="Open payment screenshot"
      >
        {proofUrl ? (
          <>
            <img src={proofUrl} alt="Payment screenshot" className="h-full w-full object-cover" />
            <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
              <ZoomIn size={20} />
            </span>
          </>
        ) : (
          <span className="text-xs text-(--text-muted)">Loading…</span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Avatar p={order.user} size="w-7 h-7" text="text-[11px]" />
          <Link to={`/admin/users/${order.user.id}`} className="font-medium hover:underline">{order.user.name}</Link>
          <span className="text-xs text-(--text-muted)">{order.user.email}</span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-(--text-muted)">Amount</dt><dd className="font-semibold">{formatPkr(order.amount)}</dd></div>
          <div><dt className="text-xs text-(--text-muted)">Sent via</dt><dd>{METHOD_LABELS[order.manualMethod] || order.manualMethod}</dd></div>
          <div><dt className="text-xs text-(--text-muted)">Transaction ID</dt><dd className="break-all font-mono text-xs">{order.manualTid}</dd></div>
          <div><dt className="text-xs text-(--text-muted)">Sent from</dt><dd className="truncate">{order.manualSender}</dd></div>
          <div><dt className="text-xs text-(--text-muted)">Reference</dt><dd className="font-mono text-xs">{order.id}</dd></div>
          <div><dt className="text-xs text-(--text-muted)">Submitted</dt><dd title={formatDateTime(order.submittedAt)}>{timeAgo(order.submittedAt)}</dd></div>
        </dl>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        {rejecting ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Reason (the user sees it), e.g. Money not received"
              className="min-w-0 flex-1 basis-56 rounded-lg border border-(--border) bg-(--input-bg) px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
            />
            <button type="button" disabled={busy} onClick={() => act("reject", { reason })} className={buttonStyles.danger}>
              Reject
            </button>
            <button type="button" disabled={busy} onClick={() => setRejecting(false)} className={buttonStyles.ghost}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => act("approve")} className={buttonStyles.primary}>
              <Check size={15} /> Money received, approve
            </button>
            <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={buttonStyles.ghost}>
              <X size={15} /> Reject
            </button>
          </div>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(false)}>
          <img src={proofUrl} alt="Payment screenshot" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </li>
  );
}
