import { useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { Search, Users, ChevronRight } from "lucide-react";
import Avatar from "../../utils/Avatar";
import { PageHeader, Panel, StatusBadge, RoleBadge, EmptyState, ErrorNote, Pager } from "./AdminUi";
import { adminApi, formatNumber, timeAgo, formatDate, STATUS_LABELS, ROLE_LABELS } from "./adminUtils";

const PAGE_SIZE = 20;

const chip = (active) =>
  `whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
    active
      ? "border-(--accent) bg-(--accent)/12 text-(--text-primary)"
      : "border-(--border) text-(--text-muted) hover:text-(--text-primary)"
  }`;

export default function AdminUsers() {
  const { token, refreshKey } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const role = params.get("role") || "";
  const page = Number(params.get("page")) || 1;
  const joined = params.get("joined") || "";
  const [search, setSearch] = useState(params.get("q") || "");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // filters live in the URL so a filtered list can be shared or reloaded
  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  // search after the admin stops typing for a moment
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== (params.get("q") || "")) update({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const query = new URLSearchParams({ page, pageSize: PAGE_SIZE });
    if (status) query.set("status", status);
    if (role) query.set("role", role);
    if (joined) query.set("joined", joined);
    if (params.get("q")) query.set("q", params.get("q"));
    adminApi(`/users?${query}`, token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, status, role, joined, page, params, refreshKey]);

  const users = data?.users || [];

  return (
    <>
      <PageHeader
        title={joined === "today" ? "New today" : "Users"}
        subtitle={data ? `${formatNumber(data.total)} accounts match` : " "}
      >
        {joined && (
          <button type="button" className={chip(true)} onClick={() => update({ joined: "" })}>
            Joined today ✕
          </button>
        )}
      </PageHeader>
      <ErrorNote text={error} />

      {/* FILTERS */}
      <div className="mb-4 space-y-3">
        <label className="relative block max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className="w-full rounded-lg border border-(--border) bg-(--input-bg) py-2 pl-9 pr-3 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-(--accent) focus:outline-none"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={chip(!status)} onClick={() => update({ status: "" })}>
            All statuses
          </button>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button key={key} type="button" className={chip(status === key)} onClick={() => update({ status: key })}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={chip(!role)} onClick={() => update({ role: "" })}>
            All roles
          </button>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <button key={key} type="button" className={chip(role === key)} onClick={() => update({ role: key })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        {!data ? (
          <p className="px-4 py-6 text-sm text-(--text-muted)">Loading…</p>
        ) : users.length === 0 ? (
          <EmptyState Icon={Users} title="No users found" text="Try another search or filter." />
        ) : (
          <>
            {/* TABLE (tablet + desktop) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-(--border) text-xs text-(--text-muted)">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-3 py-2.5 text-right font-medium">Messages</th>
                    <th className="px-3 py-2.5 text-right font-medium">Chats</th>
                    <th className="px-3 py-2.5 font-medium">Last seen</th>
                    <th className="px-4 py-2.5 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border)">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-(--border)/30">
                      <td className="px-4 py-2.5">
                        <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3">
                          <span className="relative">
                            <Avatar p={u} size="w-8 h-8" text="text-xs" />
                            {u.isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-(--panel-bg) bg-emerald-500" title="Online" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-56 truncate font-medium hover:underline">{u.name}</span>
                            <span className="block max-w-56 truncate text-xs text-(--text-muted)">{u.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={u.status} /></td>
                      <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(u._count.sentMessages)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(u._count.conversationMembers)}</td>
                      <td className="px-3 py-2.5 text-xs text-(--text-muted)">{u.isOnline ? "Online" : timeAgo(u.lastSeen)}</td>
                      <td className="px-4 py-2.5 text-xs text-(--text-muted)">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CARDS (phone) */}
            <ul className="divide-y divide-(--border) md:hidden">
              {users.map((u) => (
                <li key={u.id}>
                  <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 px-4 py-3">
                    <Avatar p={u} size="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-xs text-(--text-muted)">{u.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={u.status} />
                        <RoleBadge role={u.role} />
                        <span className="text-[11px] text-(--text-muted)">
                          {formatNumber(u._count.sentMessages)} msgs
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-(--text-muted)" />
                  </Link>
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
