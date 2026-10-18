import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { FlaskConical, CreditCard, Lock } from "lucide-react";
import { api } from "../../utils/api";
import PlusShell from "./PlusShell";
import { formatPkr } from "./plusInfo";

// Stands in for JazzCash's payment page while testing. No real money moves.
export default function TestCheckout() {
  const { orderId } = useParams();
  const { token } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/payments/orders/${orderId}`, token)
      .then(({ order: o }) => setOrder(o))
      .catch((err) => setError(err.message));
  }, [orderId, token]);

  const finish = async (outcome) => {
    setBusy(true);
    try {
      await api(`/payments/test/${orderId}/complete`, token, "POST", { outcome });
    } catch {
      // the result page shows the real state either way
    }
    navigate(`/billing/result?order=${orderId}`, { replace: true });
  };

  return (
    <PlusShell back={null}>
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
          <FlaskConical size={16} className="shrink-0" />
          <span className="text-(--text-primary)">
            <b>Test payment</b> · no real money. This page stands in for JazzCash.
          </span>
        </div>

        <section className="rounded-2xl border border-(--border) bg-(--panel-bg) p-6 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs text-(--text-muted)">
            <Lock size={12} /> Secure checkout
          </p>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          {order && (
            <>
              <h1 className="mt-2 text-lg font-semibold">Talkora Plus · {order.days} days</h1>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-(--text-muted)">Order</dt><dd className="font-mono text-xs">{order.id}</dd></div>
                <div className="flex justify-between"><dt className="text-(--text-muted)">Merchant</dt><dd>Talkora</dd></div>
                <div className="flex justify-between border-t border-(--border) pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatPkr(order.amount)}</dd></div>
              </dl>

              {order.status === "PENDING" ? (
                <div className="mt-6 space-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => finish("success")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CreditCard size={16} /> Pay {formatPkr(order.amount)}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} onClick={() => finish("fail")} className="rounded-xl border border-(--border) py-2.5 text-sm text-(--text-primary) hover:bg-(--border) disabled:opacity-60">
                      Simulate decline
                    </button>
                    <button type="button" disabled={busy} onClick={() => finish("cancel")} className="rounded-xl border border-(--border) py-2.5 text-sm text-(--text-primary) hover:bg-(--border) disabled:opacity-60">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/billing/result?order=${order.id}`, { replace: true })}
                  className="mt-6 w-full rounded-xl border border-(--border) py-3 text-sm hover:bg-(--border)"
                >
                  This order is {order.status.toLowerCase()} · see result
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </PlusShell>
  );
}
