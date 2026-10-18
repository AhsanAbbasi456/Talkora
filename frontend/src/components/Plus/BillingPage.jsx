import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Sparkles, Receipt, X, Printer, Bot, Paperclip } from "lucide-react";
import { api } from "../../utils/api";
import { fetchPlan } from "../../redux/planSlice";
import PlusShell from "./PlusShell";
import { formatPkr, PROVIDER_LABELS, METHOD_LABELS } from "./plusInfo";

const STATUS = {
  PAID: { label: "Paid", tone: "bg-emerald-500/12 text-(--status-approved) border-emerald-500/30" },
  PENDING: { label: "Pending", tone: "bg-amber-500/12 text-(--status-pending) border-amber-500/30" },
  REVIEW: { label: "Verifying", tone: "bg-amber-500/12 text-(--status-pending) border-amber-500/30" },
  FAILED: { label: "Failed", tone: "bg-red-500/12 text-(--status-banned) border-red-500/30" },
  EXPIRED: { label: "Expired", tone: "border-(--border) text-(--text-muted)" },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString([], { dateStyle: "medium" }) : "—");
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.EXPIRED;
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.tone}`}>{s.label}</span>;
}

function ReceiptDialog({ order, user, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Receipt ${order.id}`} className="w-full max-w-sm rounded-t-2xl border border-(--border) bg-(--panel-bg) p-6 sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-(--text-muted)">Receipt</p>
            <p className="mt-0.5 font-mono text-sm">{order.id}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-(--text-muted) hover:bg-(--border)"><X size={18} /></button>
        </div>
        <dl className="mt-5 space-y-2 text-sm">
          {[
            ["Billed to", `${user?.name} · ${user?.email}`],
            ["Item", `Talkora Plus · ${order.days} days`],
            ["Payment method", PROVIDER_LABELS[order.provider] || order.provider],
            ["Date", fmtDateTime(order.paidAt || order.createdAt)],
            ["Status", <StatusPill key="s" status={order.status} />],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-(--text-muted)">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-(--border) pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatPkr(order.amount)}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => window.print()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-(--border) py-2.5 text-sm hover:bg-(--border)">
          <Printer size={15} /> Print
        </button>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { token, user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    api("/payments/me", token)
      .then((result) =>
        setData({
          ...result,
          daysLeft: result.plusUntil
            ? Math.max(0, Math.ceil((new Date(result.plusUntil) - Date.now()) / 864e5))
            : 0,
        }),
      )
      .catch((err) => setError(err.message));
    dispatch(fetchPlan(token));
  }, [token, dispatch]);

  const daysLeft = data?.daysLeft || 0;

  return (
    <PlusShell>
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-sm text-(--text-muted)">Your plan, usage and payments.</p>
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {data && (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {/* PLAN */}
            <section className={`rounded-2xl border p-6 md:col-span-2 ${data.isPlus ? "border-orange-400 bg-gradient-to-br from-amber-400/10 to-orange-500/10" : "border-(--border) bg-(--panel-bg)"}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">Current plan</p>
              <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold">
                {data.isPlus ? (<><Sparkles size={22} className="text-orange-400" /> Talkora Plus</>) : "Free"}
              </h2>
              {data.isPlus ? (
                <>
                  <p className="mt-2 text-sm">
                    Active until <b>{fmtDateTime(data.plusUntil)}</b> · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                  </p>
                  <div className="mt-3 h-2 max-w-sm rounded-full bg-(--border)/60" aria-hidden="true">
                    <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, (daysLeft / 30) * 100)}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-(--text-muted)">Plus doesn't renew by itself. Add more days any time; they're added on top.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-(--text-muted)">Upgrade for unlimited AI, Summarize, Translate and 50 MB files.</p>
              )}
              <Link to="/upgrade" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95">
                <Sparkles size={15} /> {data.isPlus ? "Add 30 days" : "Upgrade to Plus"}
              </Link>
            </section>

            {/* USAGE */}
            <section className="rounded-2xl border border-(--border) bg-(--panel-bg) p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">Today's usage</p>
              <div className="mt-3 flex items-center gap-2 text-sm"><Bot size={16} className="text-(--text-muted)" /> Talkora AI</div>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {data.limits.aiPerDay === null ? "Unlimited" : `${data.aiUsedToday} / ${data.limits.aiPerDay}`}
              </p>
              {data.limits.aiPerDay !== null && (
                <div className="mt-2 h-1.5 rounded-full bg-(--border)/60" aria-hidden="true">
                  <div className="h-1.5 rounded-full bg-(--chart-1)" style={{ width: `${Math.min(100, (data.aiUsedToday / data.limits.aiPerDay) * 100)}%` }} />
                </div>
              )}
              <div className="mt-5 flex items-center gap-2 text-sm"><Paperclip size={16} className="text-(--text-muted)" /> File size limit</div>
              <p className="mt-1 text-xl font-semibold">{data.limits.maxFileMB} MB</p>
            </section>
          </div>

          {/* HISTORY */}
          <section className="mt-6 rounded-2xl border border-(--border) bg-(--panel-bg)">
            <h2 className="border-b border-(--border) px-4 py-3 text-sm font-semibold">Payment history</h2>
            {data.orders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-(--text-muted)">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-(--border)">
                {data.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-medium">Talkora Plus · {o.days} days</p>
                      <p className="text-xs text-(--text-muted)">
                        {fmtDate(o.createdAt)} · {METHOD_LABELS[o.manualMethod] || PROVIDER_LABELS[o.provider] || o.provider} · <span className="font-mono">{o.id}</span>
                      </p>
                      {o.status === "FAILED" && o.failReason && <p className="text-xs text-(--status-banned)">{o.failReason}</p>}
                    </div>
                    <span className="font-semibold tabular-nums">{formatPkr(o.amount)}</span>
                    <StatusPill status={o.status} />
                    {o.status === "PAID" ? (
                      <button type="button" onClick={() => setReceipt(o)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-(--accent) hover:bg-(--border)">
                        <Receipt size={14} /> Receipt
                      </button>
                    ) : o.status === "PENDING" || o.status === "REVIEW" ? (
                      <Link to={`/billing/result?order=${o.id}`} className="rounded-lg px-2 py-1 text-xs text-(--accent) hover:bg-(--border)">Check</Link>
                    ) : (
                      <span className="w-[68px]" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {receipt && <ReceiptDialog order={receipt} user={user} onClose={() => setReceipt(null)} />}
    </PlusShell>
  );
}
