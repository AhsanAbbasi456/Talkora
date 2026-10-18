import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ScrollText } from "lucide-react";
import { PageHeader, Panel, EmptyState, ErrorNote, Pager } from "./AdminUi";
import AuditEntry from "./AuditEntry";
import { adminApi, ACTION_LABELS } from "./adminUtils";

const FILTERS = [
  { key: "", label: "Everything" },
  { key: "USER_APPROVED", label: "Approved" },
  { key: "USER_REJECTED", label: "Rejected" },
  { key: "USER_SUSPENDED", label: "Suspended" },
  { key: "USER_BANNED", label: "Banned" },
  { key: "ROLE_CHANGED", label: "Role changes" },
  { key: "FORCE_LOGOUT", label: "Signed out" },
  { key: "PLUS_GRANTED", label: "Plus given" },
  { key: "PLUS_REVOKED", label: "Plus ended" },
  { key: "PAYMENT_APPROVED", label: "Transfers approved" },
  { key: "PAYMENT_REJECTED", label: "Transfers rejected" },
];

export default function AdminAudit() {
  const { token, refreshKey } = useOutletContext();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams({ page });
    if (action) query.set("action", action);
    adminApi(`/audit?${query}`, token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, action, page, refreshKey]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every admin action, newest first. Entries can't be edited or deleted."
      />
      <ErrorNote text={error} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setAction(f.key);
              setPage(1);
            }}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
              action === f.key
                ? "border-(--accent) bg-(--accent)/12 text-(--text-primary)"
                : "border-(--border) text-(--text-muted) hover:text-(--text-primary)"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Panel>
        {!data ? (
          <p className="px-4 py-6 text-sm text-(--text-muted)">Loading…</p>
        ) : data.entries.length === 0 ? (
          <EmptyState
            Icon={ScrollText}
            title="Nothing here yet"
            text={action ? `No "${ACTION_LABELS[action]}" actions yet.` : "Admin actions will be recorded here."}
          />
        ) : (
          <>
            <ul className="divide-y divide-(--border)">
              {data.entries.map((entry) => (
                <AuditEntry key={entry.id} entry={entry} />
              ))}
            </ul>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
