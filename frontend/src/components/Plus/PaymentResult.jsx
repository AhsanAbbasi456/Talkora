import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { CheckCircle2, XCircle, Loader2, Sparkles, Hourglass } from "lucide-react";
import { api } from "../../utils/api";
import { fetchPlan } from "../../redux/planSlice";
import PlusShell from "./PlusShell";
import { formatPkr, PROVIDER_LABELS, METHOD_LABELS } from "./plusInfo";

const POLL_MS = 3000;
const LONG_WAIT_MS = 60000;

const fmt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");

// Where people land after paying. Asks the server (never trusts the URL) and
// keeps checking while the payment company is still confirming.
export default function PaymentResult() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const { token } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [waitedLong, setWaitedLong] = useState(false);

  const status = data?.order.status;

  useEffect(() => {
    if (!orderId) return;
    let stopped = false;
    let timer;

    const load = async () => {
      try {
        const result = await api(`/payments/orders/${orderId}`, token);
        if (stopped) return;
        setData(result);
        setError("");
        if (result.order.status === "PAID") dispatch(fetchPlan(token));
        if (result.order.status === "PENDING") {
          setWaitedLong(Date.now() - startedAt > LONG_WAIT_MS);
          timer = setTimeout(load, POLL_MS);
        }
        // a transfer an admin is checking: look again every 20 seconds while the page is open
        if (result.order.status === "REVIEW") timer = setTimeout(load, 20000);
      } catch (err) {
        if (!stopped) setError(err.message);
      }
    };
    load();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId, token, dispatch, startedAt]);

  if (!orderId) return <Navigate to="/billing" replace />;

  const order = data?.order;

  return (
    <PlusShell back={{ to: "/billing", label: "Billing" }}>
      <div className="mx-auto max-w-md rounded-2xl border border-(--border) bg-(--panel-bg) p-6 text-center sm:p-8" aria-live="polite">
        {error && !data && <p className="text-sm text-red-500">{error}</p>}

        {!data && !error && (
          <p className="flex items-center justify-center gap-2 text-sm text-(--text-muted)">
            <Loader2 size={16} className="animate-spin" /> Checking your payment…
          </p>
        )}

        {status === "PENDING" && (
          <>
            <Loader2 size={44} className="mx-auto animate-spin text-(--accent)" />
            <h1 className="mt-4 text-xl font-semibold">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-(--text-muted)">
              {waitedLong
                ? "This is taking longer than usual. If you paid, Plus turns on by itself as soon as the payment company confirms. You can safely leave this page."
                : "Please keep this page open. This usually takes a few seconds."}
            </p>
          </>
        )}

        {status === "REVIEW" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15 text-amber-500">
              <Hourglass size={30} />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Payment sent for verification</h1>
            <p className="mt-2 text-sm text-(--text-muted)">
              We're checking that your transfer arrived. This usually takes a few hours. Plus turns on by itself and
              you'll get an email. You can close this page.
            </p>
          </>
        )}

        {status === "PAID" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
              <Sparkles size={30} />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Welcome to Talkora Plus!</h1>
            <p className="mt-2 text-sm text-(--text-muted)">
              Plus is active until <b className="text-(--text-primary)">{fmt(data.me.plusUntil)}</b>.
            </p>
          </>
        )}

        {(status === "FAILED" || status === "EXPIRED") && (
          <>
            <XCircle size={52} className="mx-auto text-red-500" />
            <h1 className="mt-4 text-xl font-semibold">Payment didn't go through</h1>
            <p className="mt-2 text-sm text-(--text-muted)">
              {order.failReason || "The payment was not completed."} You were not charged for this order.
            </p>
          </>
        )}

        {order && (
          <dl className="mt-6 space-y-1.5 rounded-xl border border-(--border) bg-(--app-bg) p-4 text-left text-sm">
            <div className="flex justify-between gap-3"><dt className="text-(--text-muted)">Order</dt><dd className="font-mono text-xs">{order.id}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-(--text-muted)">Plan</dt><dd>Talkora Plus · {order.days} days</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-(--text-muted)">Amount</dt><dd className="font-semibold">{formatPkr(order.amount)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-(--text-muted)">Method</dt><dd>{METHOD_LABELS[order.manualMethod] || PROVIDER_LABELS[order.provider] || order.provider}</dd></div>
            {order.manualTid && <div className="flex justify-between gap-3"><dt className="text-(--text-muted)">Transaction ID</dt><dd className="font-mono text-xs">{order.manualTid}</dd></div>}
            {order.paidAt && <div className="flex justify-between gap-3"><dt className="text-(--text-muted)">Paid</dt><dd>{fmt(order.paidAt)}</dd></div>}
          </dl>
        )}

        {status && status !== "PENDING" && status !== "REVIEW" && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {status === "PAID" ? (
              <Link to="/home" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-(--accent) py-3 text-sm font-semibold text-[#F8FAFC] hover:opacity-90">
                <CheckCircle2 size={16} /> Start using Plus
              </Link>
            ) : (
              <Link to="/upgrade" className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-semibold text-white hover:opacity-95">
                Try again
              </Link>
            )}
            <Link to="/billing" className="flex-1 rounded-xl border border-(--border) py-3 text-sm hover:bg-(--border)">
              View billing
            </Link>
          </div>
        )}
      </div>
    </PlusShell>
  );
}
