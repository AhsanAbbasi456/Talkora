import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { UserPlus, Users, MessageSquare, Phone, UsersRound, Sparkles, Check, X, Inbox } from "lucide-react";
import Avatar from "../../utils/Avatar";
import DailyChart from "./DailyChart";
import useStatusChange from "./useStatusChange";
import { PageHeader, Panel, StatTile, StatusBadge, EmptyState, ErrorNote } from "./AdminUi";
import AuditEntry from "./AuditEntry";
import { adminApi, formatNumber, timeAgo, MESSAGE_TYPE_LABELS, STATUS_LABELS, buttonStyles } from "./adminUtils";

export default function AdminDashboard() {
  const { token, refreshKey } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const { ask, approveNow, dialog } = useStatusChange();

  useEffect(() => {
    adminApi("/stats", token)
      .then(setStats)
      .catch((err) => setError(err.message));
  }, [token, refreshKey]);

  if (!stats) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorNote text={error} />
        {!error && <p className="text-sm text-(--text-muted)">Loading…</p>}
      </>
    );
  }

  const { users, messages, calls, conversations, series, pending, recentActions } = stats;
  const pendingTotal = users.byStatus.PENDING || 0;

  // ranked list: biggest message type first
  const types = Object.entries(messages.byType).sort((a, b) => b[1] - a[1]);
  const typeMax = Math.max(1, ...types.map(([, n]) => n));

  const approve = async (user) => {
    try {
      await approveNow([user]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Activity across Talkora. Message content is never shown here." />
      <ErrorNote text={error} />

      {/* HEADLINE NUMBERS */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          to="/admin/requests"
          label="Pending requests"
          value={formatNumber(pendingTotal)}
          hint={pendingTotal ? "Waiting for you" : "All caught up"}
          Icon={UserPlus}
        />
        <StatTile to="/admin/users" label="Users" value={formatNumber(users.total)} hint={`${users.onlineNow} online now`} Icon={Users} />
        <StatTile to="/admin/users?joined=today" label="New today" value={formatNumber(users.signupsToday)} hint="Sign-ups" Icon={Sparkles} />
        <StatTile
          label="Messages today"
          value={formatNumber(messages.today)}
          hint={`${formatNumber(messages.total)} all time`}
          Icon={MessageSquare}
        />
        <StatTile
          to="/admin/calls?range=today"
          label="Calls today"
          value={formatNumber(calls.today)}
          hint={`${formatNumber(calls.totalMinutes)} min all time`}
          Icon={Phone}
        />
        <StatTile
          to="/admin/groups"
          label="Groups"
          value={formatNumber(conversations.groups)}
          hint={`${formatNumber(conversations.direct)} direct chat${conversations.direct === 1 ? "" : "s"}`}
          Icon={UsersRound}
        />
      </div>

      {/* TRENDS */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Sign-ups per day · last 30 days">
          <div className="px-3 pb-3 pt-4">
            <DailyChart data={series.signups} label="Sign-ups" />
          </div>
        </Panel>
        <Panel title="Messages per day · last 30 days">
          <div className="px-3 pb-3 pt-4">
            <DailyChart data={series.messages} label="Messages" />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* WAITING FOR APPROVAL */}
        <Panel
          className="lg:col-span-2"
          title="Waiting for approval"
          action={
            pendingTotal > pending.length && (
              <Link to="/admin/requests" className="text-xs font-medium text-(--accent)">
                See all {pendingTotal}
              </Link>
            )
          }
        >
          {pending.length ? (
            <ul className="divide-y divide-(--border)">
              {pending.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar p={u} size="w-9 h-9" />
                  <div className="min-w-0 flex-1 basis-40">
                    <Link to={`/admin/users/${u.id}`} className="block truncate text-sm font-medium hover:underline">
                      {u.name}
                    </Link>
                    <p className="truncate text-xs text-(--text-muted)">
                      {u.email} · {timeAgo(u.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => approve(u)} className={buttonStyles.primary}>
                      <Check size={15} /> Approve
                    </button>
                    <button type="button" onClick={() => ask("REJECTED", [u])} className={buttonStyles.ghost}>
                      <X size={15} /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState Icon={Inbox} title="No pending requests" text="New sign-ups will show up here right away." />
          )}
        </Panel>

        {/* USERS BY STATUS */}
        <Panel title="Accounts by status">
          <ul className="divide-y divide-(--border)">
            {Object.keys(STATUS_LABELS).map((status) => (
              <li key={status}>
                <Link
                  to={`/admin/users?status=${status}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-(--border)/40"
                >
                  <StatusBadge status={status} />
                  <span className="font-medium tabular-nums">{formatNumber(users.byStatus[status] || 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* MESSAGES BY TYPE */}
        <Panel title="Messages by type · all time">
          {types.length ? (
            <ul className="space-y-3 p-4">
              {types.map(([type, count]) => (
                <li key={type}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-(--text-primary)">{MESSAGE_TYPE_LABELS[type] || type}</span>
                    <span className="tabular-nums text-(--text-muted)">{formatNumber(count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-(--border)/50">
                    <div
                      className="h-2 rounded-full bg-(--chart-1)"
                      style={{ width: `${Math.max(2, (count / typeMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState Icon={MessageSquare} title="No messages yet" />
          )}
        </Panel>

        {/* RECENT ADMIN ACTIONS */}
        <Panel
          className="lg:col-span-2"
          title="Recent admin actions"
          action={
            <Link to="/admin/audit" className="text-xs font-medium text-(--accent)">
              Audit log
            </Link>
          }
        >
          {recentActions.length ? (
            <ul className="divide-y divide-(--border)">
              {recentActions.map((entry) => (
                <AuditEntry key={entry.id} entry={entry} />
              ))}
            </ul>
          ) : (
            <EmptyState Icon={Inbox} title="No admin actions yet" />
          )}
        </Panel>
      </div>

      {dialog}
    </>
  );
}
