import { useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { CreditCard } from "lucide-react";
import Avatar from "../../utils/Avatar";
import { PageHeader, Panel, StatTile, EmptyState, ErrorNote, Pager } from "./AdminUi";
import { adminApi, formatNumber, formatDateTime, timeAgo } from "./adminUtils";
import { formatPkr, PROVIDER_LABELS, METHOD_LABELS } from "../Plus/plusInfo";
import PaymentReviewCard from "./PaymentReviewCard";

const STATUS_TONE = {
  REVIEW: "bg-amber-500/12 text-(--status-pending) border-amber-500/30",
  PAID: "bg-emerald-500/12 text-(--status-approved) border-emerald-500/30",
  PENDING: "bg-amber-500/12 text-(--status-pending) border-amber-500/30",
  FAILED: "bg-red-500/12 text-(--status-banned) border-red-500/30",
  EXPIRED: "border-(--border) text-(--text-muted)",
};
const STATUS_LABEL = { REVIEW: "To verify", PAID: "Paid", PENDING: "Pending", FAILED: "Failed", EXPIRED: "Expired" };

const chip = (active) =>
  `whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
    active
      ? "border-(--accent) bg-(--accent)/12 text-(--text-primary)"
      : "border-(--border) text-(--text-muted) hover:text-(--text-primary)"
  }`;

function OrderStatus({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[status] || ""}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function AdminPayments() {
  const { token, refreshKey, refresh } = useOutletContext();
  const [toReview, setToReview] = useState([]);
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const provider = params.get("provider") || "";
  const page = Number(params.get("page")) || 1;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const query = new URLSearchParams({ page });
    if (status) query.set("status", status);
    if (provider) query.set("provider", provider);
    adminApi(`/payments?${query}`, token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, status, provider, page, refreshKey]);

  // transfers waiting for an admin always show on top
  useEffect(() => {
    adminApi("/payments?status=REVIEW", token)
      .then((result) => setToReview(result.orders))
      .catch(() => {});
  }, [token, refreshKey]);

  const s = data?.summary;

  return (
    <>
      <PageHeader title="Payments" subtitle="Talkora Plus orders. Test and admin-gifted orders don't count as revenue." />
      <ErrorNote text={error} />

      {toReview.length > 0 && (
        <Panel
          className="mb-4 border-amber-500/50"
          title={`To verify (${toReview.length})`}
          action={<span className="text-[11px] text-(--text-muted)">Check each TID and amount in your bank / wallet app first</span>}
        >
          <ul className="divide-y divide-(--border)">
            {toReview.map((o) => (
              <PaymentReviewCard key={o.id} order={o} token={token} onDone={refresh} />
            ))}
          </ul>
        </Panel>
      )}

      {s && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Revenue · all time" value={formatPkr(s.revenueTotal)} hint={`${formatNumber(s.paidOrders)} paid orders`} />
          <StatTile label="Revenue · 30 days" value={formatPkr(s.revenue30d)} />
          <StatTile to="/admin/users" label="Plus users now" value={formatNumber(s.plusUsers)} hint="Active passes" />
          <StatTile label="Paid today" value={formatNumber(s.paidToday)} hint="incl. test & gifts" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={chip(!status)} onClick={() => update({ status: "" })}>All statuses</button>
          {Object.keys(STATUS_LABEL).map((key) => (
            <button key={key} type="button" className={chip(status === key)} onClick={() => update({ status: key })}>
              {STATUS_LABEL[key]}{s?.byStatus[key] ? ` · ${s.byStatus[key]}` : ""}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={chip(!provider)} onClick={() => update({ provider: "" })}>All methods</button>
          {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
            <button key={key} type="button" className={chip(provider === key)} onClick={() => update({ provider: key })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        {!data ? (
          <p className="px-4 py-6 text-sm text-(--text-muted)">Loading…</p>
        ) : data.orders.length === 0 ? (
          <EmptyState Icon={CreditCard} title="No orders yet" text="Orders appear here as soon as someone starts a payment." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-(--border) text-xs text-(--text-muted)">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-3 py-2.5 font-medium">Order</th>
                    <th className="px-3 py-2.5 font-medium">Method</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Created</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border)">
                  {data.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-(--border)/30">
                      <td className="px-4 py-2.5">
                        <Link to={`/admin/users/${o.user.id}`} className="flex items-center gap-2 hover:underline">
                          <Avatar p={o.user} size="w-7 h-7" text="text-[11px]" />
                          <span className="max-w-44 truncate">{o.user.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs">{o.id}</span>
                        <span className="block text-[11px] text-(--text-muted)">Plus · {o.days} days</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {METHOD_LABELS[o.manualMethod] || PROVIDER_LABELS[o.provider] || o.provider}
                        {o.manualTid && <span className="block font-mono text-[11px] text-(--text-muted)">TID {o.manualTid}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <OrderStatus status={o.status} />
                        {o.failReason && o.status !== "PAID" && (
                          <span className="block max-w-48 truncate text-[11px] text-(--text-muted)" title={o.failReason}>{o.failReason}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-(--text-muted)">{formatDateTime(o.createdAt)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatPkr(o.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-(--border) md:hidden">
              {data.orders.map((o) => (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar p={o.user} size="w-8 h-8" text="text-xs" />
                    <Link to={`/admin/users/${o.user.id}`} className="min-w-0 flex-1 truncate text-sm font-medium">{o.user.name}</Link>
                    <span className="font-semibold tabular-nums">{formatPkr(o.amount)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-10 text-xs text-(--text-muted)">
                    <OrderStatus status={o.status} />
                    <span>{PROVIDER_LABELS[o.provider] || o.provider}</span>
                    <span>{timeAgo(o.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </Panel>
    </>
  );
}
