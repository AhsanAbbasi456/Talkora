import { useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { Phone, Video, ArrowRight, PhoneOff, X } from "lucide-react";
import Avatar from "../../utils/Avatar";
import { PageHeader, Panel, StatTile, EmptyState, ErrorNote, Pager } from "./AdminUi";
import {
  adminApi,
  formatNumber,
  formatDuration,
  formatTotalTime,
  formatDateTime,
  timeAgo,
  CALL_STATUS_LABELS,
} from "./adminUtils";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

const TYPES = [
  { key: "", label: "Voice + video" },
  { key: "audio", label: "Voice" },
  { key: "video", label: "Video" },
];

// answered / missed get a color; everything else stays neutral. Always with a label.
const STATUS_TONE = {
  completed: "text-(--status-approved) bg-emerald-500/12 border-emerald-500/30",
  missed: "text-(--status-banned) bg-red-500/12 border-red-500/30",
  declined: "text-(--status-suspended) bg-orange-500/12 border-orange-500/30",
};

const chip = (active) =>
  `whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
    active
      ? "border-(--accent) bg-(--accent)/12 text-(--text-primary)"
      : "border-(--border) text-(--text-muted) hover:text-(--text-primary)"
  }`;

function CallStatus({ status }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        STATUS_TONE[status] || "border-(--border) text-(--text-muted)"
      }`}
    >
      {CALL_STATUS_LABELS[status] || status}
    </span>
  );
}

function Person({ p }) {
  if (!p) return <span className="text-(--text-muted)">Deleted user</span>;
  return (
    <Link to={`/admin/users/${p.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
      <Avatar p={p} size="w-7 h-7" text="text-[11px]" />
      <span className="truncate">{p.name}</span>
    </Link>
  );
}

export default function AdminCalls() {
  const { token, refreshKey } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const range = params.get("range") || "all";
  const status = params.get("status") || "";
  const type = params.get("type") || "";
  const userId = params.get("userId") || "";
  const page = Number(params.get("page")) || 1;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const query = new URLSearchParams({ range, page });
    if (status) query.set("status", status);
    if (type) query.set("type", type);
    if (userId) query.set("userId", userId);
    adminApi(`/calls?${query}`, token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, range, status, type, userId, page, refreshKey]);

  const summary = data?.summary;
  const statuses = summary ? Object.entries(summary.byStatus).sort((a, b) => b[1] - a[1]) : [];
  const rangeLabel = RANGES.find((r) => r.key === range)?.label.toLowerCase();

  return (
    <>
      <PageHeader
        title={data?.user ? `Calls of ${data.user.name}` : "Calls"}
        subtitle="Who called whom, when and for how long. Calls are never recorded."
      >
        {userId && (
          <button type="button" onClick={() => update({ userId: "" })} className={chip(true)}>
            <span className="inline-flex items-center gap-1">
              Only {data?.user?.name || "this user"} <X size={12} />
            </span>
          </button>
        )}
      </PageHeader>
      <ErrorNote text={error} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {RANGES.map((r) => (
          <button key={r.key} type="button" className={chip(range === r.key)} onClick={() => update({ range: r.key })}>
            {r.label}
          </button>
        ))}
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Calls" value={formatNumber(summary.count)} hint={rangeLabel} />
          <StatTile
            label="Answered"
            value={formatNumber(summary.answered)}
            hint={summary.count ? `${Math.round((summary.answered / summary.count) * 100)}% of calls` : "—"}
          />
          <StatTile label="Total talk time" value={formatTotalTime(summary.totalSeconds)} hint={rangeLabel} />
          <StatTile
            label="Average call"
            value={summary.answered ? formatDuration(summary.averageSeconds) : "—"}
            hint="Answered calls only"
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={chip(!status)} onClick={() => update({ status: "" })}>
            All {summary ? `· ${summary.count}` : ""}
          </button>
          {statuses.map(([key, count]) => (
            <button key={key} type="button" className={chip(status === key)} onClick={() => update({ status: key })}>
              {CALL_STATUS_LABELS[key] || key} · {count}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPES.map((t) => (
            <button key={t.key} type="button" className={chip(type === t.key)} onClick={() => update({ type: t.key })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        {!data ? (
          <p className="px-4 py-6 text-sm text-(--text-muted)">Loading…</p>
        ) : data.calls.length === 0 ? (
          <EmptyState Icon={PhoneOff} title="No calls found" text="Try another time range or filter." />
        ) : (
          <>
            {/* TABLE (tablet + desktop) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-(--border) text-xs text-(--text-muted)">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Caller</th>
                    <th className="px-1 py-2.5"><span className="sr-only">to</span></th>
                    <th className="px-3 py-2.5 font-medium">Receiver</th>
                    <th className="px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Started</th>
                    <th className="px-4 py-2.5 text-right font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border)">
                  {data.calls.map((c) => {
                    const TypeIcon = c.callType === "video" ? Video : Phone;
                    return (
                      <tr key={c.id} className="hover:bg-(--border)/30">
                        <td className="max-w-48 px-4 py-2.5"><Person p={c.caller} /></td>
                        <td className="px-1 py-2.5 text-(--text-muted)"><ArrowRight size={14} /></td>
                        <td className="max-w-48 px-3 py-2.5"><Person p={c.callee} /></td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-(--text-muted)">
                            <TypeIcon size={14} /> {c.callType === "video" ? "Video" : "Voice"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5"><CallStatus status={c.status} /></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-(--text-muted)" title={formatDateTime(c.createdAt)}>
                          {formatDateTime(c.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {c.durationSeconds > 0 ? formatDuration(c.durationSeconds) : <span className="text-(--text-muted)">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* CARDS (phone) */}
            <ul className="divide-y divide-(--border) md:hidden">
              {data.calls.map((c) => {
                const TypeIcon = c.callType === "video" ? Video : Phone;
                return (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="min-w-0 flex-1"><Person p={c.caller} /></div>
                      <ArrowRight size={14} className="shrink-0 text-(--text-muted)" />
                      <div className="min-w-0 flex-1"><Person p={c.callee} /></div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-(--text-muted)">
                      <TypeIcon size={14} aria-label={c.callType === "video" ? "Video call" : "Voice call"} />
                      <CallStatus status={c.status} />
                      <span>{timeAgo(c.createdAt)}</span>
                      <span className="ml-auto text-sm font-medium tabular-nums text-(--text-primary)">
                        {c.durationSeconds > 0 ? formatDuration(c.durationSeconds) : "—"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </Panel>
    </>
  );
}
