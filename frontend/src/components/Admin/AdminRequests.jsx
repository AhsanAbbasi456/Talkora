import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Check, X, Inbox } from "lucide-react";
import Avatar from "../../utils/Avatar";
import useStatusChange from "./useStatusChange";
import { PageHeader, Panel, EmptyState, ErrorNote, Pager } from "./AdminUi";
import { adminApi, timeAgo, formatDateTime, buttonStyles } from "./adminUtils";

const PAGE_SIZE = 25;

export default function AdminRequests() {
  const { token, refreshKey } = useOutletContext();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const { ask, approveNow, dialog } = useStatusChange({ onDone: () => setSelected(new Set()) });

  useEffect(() => {
    adminApi(`/users?status=PENDING&page=${page}&pageSize=${PAGE_SIZE}`, token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, page, refreshKey]);

  const users = data?.users || [];
  const chosen = users.filter((u) => selected.has(u.id));
  const allChosen = users.length > 0 && chosen.length === users.length;

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(users.map((u) => u.id)));

  const approve = async (list) => {
    setError("");
    try {
      await approveNow(list);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Access requests"
        subtitle="People who verified their email and are waiting to join. Oldest first."
      >
        {chosen.length > 0 && (
          <>
            <button type="button" onClick={() => approve(chosen)} className={buttonStyles.primary}>
              <Check size={15} /> Approve {chosen.length}
            </button>
            <button type="button" onClick={() => ask("REJECTED", chosen)} className={buttonStyles.ghost}>
              <X size={15} /> Reject {chosen.length}
            </button>
          </>
        )}
      </PageHeader>
      <ErrorNote text={error} />

      <Panel>
        {!data ? (
          <p className="px-4 py-6 text-sm text-(--text-muted)">Loading…</p>
        ) : users.length === 0 ? (
          <EmptyState Icon={Inbox} title="No pending requests" text="New sign-ups appear here as soon as they verify their email." />
        ) : (
          <>
            <label className="flex items-center gap-3 border-b border-(--border) px-4 py-2.5 text-xs text-(--text-muted)">
              <input type="checkbox" checked={allChosen} onChange={toggleAll} className="h-4 w-4 accent-(--accent)" />
              Select all on this page
            </label>
            <ul className="divide-y divide-(--border)">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    aria-label={`Select ${u.name}`}
                    className="h-4 w-4 accent-(--accent)"
                  />
                  <Avatar p={u} size="w-10 h-10" />
                  <div className="min-w-0 flex-1 basis-40">
                    <Link to={`/admin/users/${u.id}`} className="block truncate text-sm font-medium hover:underline">
                      {u.name}
                    </Link>
                    <p className="truncate text-xs text-(--text-muted)">{u.email}</p>
                  </div>
                  <time
                    dateTime={u.createdAt}
                    title={formatDateTime(u.createdAt)}
                    className="text-xs text-(--text-muted) max-sm:order-last max-sm:w-full max-sm:pl-7"
                  >
                    Signed up {timeAgo(u.createdAt)}
                  </time>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => approve([u])} className={buttonStyles.primary}>
                      <Check size={15} /> Approve
                    </button>
                    <button type="button" onClick={() => ask("REJECTED", [u])} className={buttonStyles.ghost}>
                      <X size={15} />
                      <span className="max-sm:sr-only">Reject</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>

      {dialog}
    </>
  );
}
