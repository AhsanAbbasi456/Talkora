import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Search, UsersRound, ChevronDown, Lock } from "lucide-react";
import Avatar from "../../utils/Avatar";
import { PageHeader, Panel, EmptyState, ErrorNote, Pager } from "./AdminUi";
import { adminApi, formatNumber, formatDate, timeAgo } from "./adminUtils";

export default function AdminGroups() {
  const { token, refreshKey } = useOutletContext();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null); // id of the group showing its members
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // search after the admin stops typing for a moment
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams({ page });
    if (query) params.set("q", query);
    adminApi(`/groups?${params}`, token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, query, page, refreshKey]);

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle={data ? `${formatNumber(data.total)} groups · most active first` : " "}
      />
      <ErrorNote text={error} />

      <label className="relative mb-4 block max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search group name"
          aria-label="Search groups"
          className="w-full rounded-lg border border-(--border) bg-(--input-bg) py-2 pl-9 pr-3 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-(--accent) focus:outline-none"
        />
      </label>

      <Panel
        action={
          <span className="flex items-center gap-1 text-[11px] text-(--text-muted)">
            <Lock size={12} /> Messages are private
          </span>
        }
        title="All groups"
      >
        {!data ? (
          <p className="px-4 py-6 text-sm text-(--text-muted)">Loading…</p>
        ) : data.groups.length === 0 ? (
          <EmptyState Icon={UsersRound} title="No groups found" text={query ? "Try another name." : "Groups people create will show up here."} />
        ) : (
          <>
            <ul className="divide-y divide-(--border)">
              {data.groups.map((g) => {
                const isOpen = open === g.id;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : g.id)}
                      aria-expanded={isOpen}
                      className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-(--border)/30"
                    >
                      <Avatar p={g} size="w-10 h-10" />
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate text-sm font-medium">{g.name || "Unnamed group"}</p>
                        <p className="truncate text-xs text-(--text-muted)">
                          Created by {g.creator?.name || "a deleted user"} · {formatDate(g.createdAt)}
                        </p>
                      </div>

                      {/* first members, then "+N" */}
                      <div className="hidden -space-x-2 sm:flex" aria-hidden="true">
                        {g.members.slice(0, 4).map((m) => (
                          <span key={m.user.id} className="rounded-full ring-2 ring-(--panel-bg)">
                            <Avatar p={m.user} size="w-7 h-7" text="text-[11px]" />
                          </span>
                        ))}
                        {g.members.length > 4 && (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--border) text-[10px] font-semibold ring-2 ring-(--panel-bg)">
                            +{g.members.length - 4}
                          </span>
                        )}
                      </div>

                      <dl className="flex gap-4 text-xs text-(--text-muted)">
                        <div className="text-right">
                          <dt>Members</dt>
                          <dd className="text-sm font-medium tabular-nums text-(--text-primary)">{g.members.length}</dd>
                        </div>
                        <div className="text-right">
                          <dt>Messages</dt>
                          <dd className="text-sm font-medium tabular-nums text-(--text-primary)">{formatNumber(g._count.messages)}</dd>
                        </div>
                        <div className="text-right">
                          <dt>Active</dt>
                          <dd className="text-sm font-medium text-(--text-primary)">{timeAgo(g.lastMessageAt)}</dd>
                        </div>
                      </dl>
                      <ChevronDown size={16} className={`shrink-0 text-(--text-muted) transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen && (
                      <ul className="grid gap-1 border-t border-(--border) bg-(--app-bg)/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                        {g.members.map((m) => (
                          <li key={m.user.id}>
                            <Link
                              to={`/admin/users/${m.user.id}`}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-(--border)/50"
                            >
                              <Avatar p={m.user} size="w-7 h-7" text="text-[11px]" />
                              <span className="min-w-0 flex-1 truncate">{m.user.name}</span>
                              {m.role === "ADMIN" && <span className="text-[10px] text-(--text-muted)">Group admin</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
