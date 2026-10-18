import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  X,
  PauseCircle,
  Ban,
  RotateCcw,
  LogOut,
  ShieldPlus,
  ShieldMinus,
  Lock,
  Users,
  User as UserIcon,
  MessageSquare,
  Inbox,
  Sparkles,
} from "lucide-react";
import PlusTag from "../Plus/PlusTag";
import Avatar from "../../utils/Avatar";
import useStatusChange from "./useStatusChange";
import { Panel, StatTile, StatusBadge, RoleBadge, EmptyState, ErrorNote } from "./AdminUi";
import AuditEntry from "./AuditEntry";
import {
  adminApi,
  canManage,
  formatNumber,
  formatDate,
  formatDateTime,
  timeAgo,
  MESSAGE_TYPE_LABELS,
  buttonStyles,
} from "./adminUtils";

export default function AdminUserDetail() {
  const { id } = useParams();
  const { me, token, refreshKey, refresh } = useOutletContext();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null); // { title, text, button, run }
  const [busy, setBusy] = useState(false);
  const { ask, approveNow, dialog } = useStatusChange();

  useEffect(() => {
    adminApi(`/users/${id}`, token)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [id, token, refreshKey]);

  if (!data) {
    return (
      <>
        <BackLink />
        <ErrorNote text={error} />
        {!error && <p className="text-sm text-(--text-muted)">Loading…</p>}
      </>
    );
  }

  const { user, stats, conversations, history } = data;
  const manageable = canManage(me, user);
  const c = user._count;
  const types = Object.entries(stats.messagesByType).sort((a, b) => b[1] - a[1]);
  const typeMax = Math.max(1, ...types.map(([, n]) => n));

  const isPlusUser = Boolean(user.plusUntil && new Date(user.plusUntil) > new Date());

  const giftPlus = (days) =>
    setConfirm({
      title: `Give ${user.name} ${days} days of Plus?`,
      text: isPlusUser
        ? `The days are added to their current Plus. It's free for them and doesn't count as revenue.`
        : "They get every Plus feature right away, for free. It doesn't count as revenue.",
      button: `Give ${days} days`,
      run: () => adminApi(`/users/${user.id}/plus`, token, "POST", { days }),
    });

  const endPlus = () =>
    setConfirm({
      title: `End ${user.name}'s Plus now?`,
      text: "They go back to Free immediately. Use this for refunds or mistakes. Their payment history stays.",
      button: "End Plus",
      run: () => adminApi(`/users/${user.id}/plus`, token, "DELETE"),
    });

  const runConfirm = async () => {
    setBusy(true);
    setError("");
    try {
      await confirm.run();
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setError("");
    try {
      await approveNow([user]);
    } catch (err) {
      setError(err.message);
    }
  };

  const forceLogout = () =>
    setConfirm({
      title: `Sign ${user.name} out everywhere?`,
      text: "Every open tab and device is logged out. They can log in again right away.",
      button: "Sign out",
      run: () => adminApi(`/users/${user.id}/logout`, token, "POST"),
    });

  const changeRole = (role) =>
    setConfirm({
      title: role === "ADMIN" ? `Make ${user.name} an admin?` : `Remove admin from ${user.name}?`,
      text:
        role === "ADMIN"
          ? "Admins can approve, suspend and ban users, manage other admins and see all activity numbers. They can't read messages."
          : "They go back to being a normal user and lose access to the admin page.",
      button: role === "ADMIN" ? "Make admin" : "Remove admin",
      run: () => adminApi(`/users/${user.id}/role`, token, "POST", { role }),
    });

  return (
    <>
      <BackLink />
      <ErrorNote text={error} />

      {/* PROFILE + ACTIONS */}
      <Panel className="mb-4">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
          <div className="relative w-fit">
            <Avatar p={user} size="w-16 h-16" text="text-xl" />
            {user.isOnline && (
              <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-(--panel-bg) bg-emerald-500" title="Online" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold">{user.name}</h1>
              <StatusBadge status={user.status} />
              {isPlusUser && <PlusTag />}
              <RoleBadge role={user.role} />
            </div>
            <p className="mt-0.5 truncate text-sm text-(--text-muted)">{user.email}</p>
            {user.about && <p className="mt-2 text-sm text-(--text-secondary)">{user.about}</p>}

            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-(--text-muted) sm:grid-cols-2">
              <div><dt className="inline">Joined: </dt><dd className="inline text-(--text-primary)">{formatDateTime(user.createdAt)}</dd></div>
              <div><dt className="inline">Last seen: </dt><dd className="inline text-(--text-primary)">{user.isOnline ? "Online now" : formatDateTime(user.lastSeen)}</dd></div>
              <div><dt className="inline">Email verified: </dt><dd className="inline text-(--text-primary)">{user.emailVerified ? "Yes" : "No"}</dd></div>
              {user.statusChangedAt && (
                <div><dt className="inline">Status changed: </dt><dd className="inline text-(--text-primary)">{formatDateTime(user.statusChangedAt)}</dd></div>
              )}
            </dl>

            {(user.statusReason || user.suspendedUntil) && (
              <div className="mt-3 rounded-lg border border-(--border) bg-(--app-bg) px-3 py-2 text-xs">
                {user.suspendedUntil && (
                  <p>Suspended until <span className="font-medium">{formatDateTime(user.suspendedUntil)}</span></p>
                )}
                {user.statusReason && <p className="text-(--text-muted)">Reason: “{user.statusReason}”</p>}
              </div>
            )}
          </div>
        </div>

        {manageable ? (
          <div className="flex flex-wrap gap-2 border-t border-(--border) px-4 py-3 sm:px-5">
            {user.status === "PENDING" && (
              <>
                <button type="button" className={buttonStyles.primary} onClick={restore}><Check size={15} /> Approve</button>
                <button type="button" className={buttonStyles.ghost} onClick={() => ask("REJECTED", [user])}><X size={15} /> Reject</button>
              </>
            )}
            {["REJECTED", "SUSPENDED", "BANNED"].includes(user.status) && (
              <button type="button" className={buttonStyles.primary} onClick={restore}><RotateCcw size={15} /> Restore access</button>
            )}
            {["APPROVED", "SUSPENDED"].includes(user.status) && (
              <>
                <button type="button" className={buttonStyles.ghost} onClick={() => ask("SUSPENDED", [user])}>
                  <PauseCircle size={15} /> {user.status === "SUSPENDED" ? "Change suspension" : "Suspend"}
                </button>
                <button type="button" className={buttonStyles.danger} onClick={() => ask("BANNED", [user])}><Ban size={15} /> Ban</button>
              </>
            )}
            {user.status === "APPROVED" && (
              <button type="button" className={buttonStyles.ghost} onClick={forceLogout}><LogOut size={15} /> Sign out everywhere</button>
            )}
            {user.status === "APPROVED" && (
              user.role === "ADMIN" ? (
                <button type="button" className={buttonStyles.ghost} onClick={() => changeRole("USER")}><ShieldMinus size={15} /> Remove admin</button>
              ) : (
                <button type="button" className={buttonStyles.ghost} onClick={() => changeRole("ADMIN")}><ShieldPlus size={15} /> Make admin</button>
              )
            )}
          </div>
        ) : (
          <p className="border-t border-(--border) px-4 py-3 text-xs text-(--text-muted) sm:px-5">
            This is your account. Another admin has to change it.
          </p>
        )}
      </Panel>

      {/* ACTIVITY NUMBERS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Messages sent" value={formatNumber(c.sentMessages)} />
        <StatTile label="Received (direct)" value={formatNumber(c.receivedMessages)} />
        <StatTile label="Chats" value={formatNumber(c.conversationMembers)} hint={`${c.createdGroups} groups created`} />
        <StatTile
          to={`/admin/calls?userId=${user.id}`}
          label="Calls"
          value={formatNumber(c.callsMade + c.callsReceived)}
          hint={`${c.callsMade} made · ${c.callsReceived} received`}
        />
        <StatTile label="Call time" value={`${formatNumber(stats.callMinutes)} min`} />
        <StatTile label="Reactions" value={formatNumber(c.reactions)} hint={`${c.pollVotes} poll votes`} />
      </div>

      {/* TALKORA PLUS */}
      <Panel
        className="mt-4"
        title="Talkora Plus"
        action={
          <Link to={`/admin/payments`} className="text-xs font-medium text-(--accent)">
            All payments
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 basis-56 text-sm">
            {isPlusUser ? (
              <>
                <Sparkles size={14} className="mr-1 inline text-orange-400" />
                Plus until <b>{formatDateTime(user.plusUntil)}</b>
              </>
            ) : (
              <span className="text-(--text-muted)">Free plan{user.plusUntil ? ` · Plus ended ${formatDate(user.plusUntil)}` : ""}</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonStyles.ghost} onClick={() => giftPlus(7)}>Give 7 days</button>
            <button type="button" className={buttonStyles.ghost} onClick={() => giftPlus(30)}>Give 30 days</button>
            {isPlusUser && (
              <button type="button" className={buttonStyles.danger} onClick={endPlus}>End Plus</button>
            )}
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Messages sent by type">
          {types.length ? (
            <ul className="space-y-3 p-4">
              {types.map(([type, count]) => (
                <li key={type}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{MESSAGE_TYPE_LABELS[type] || type}</span>
                    <span className="tabular-nums text-(--text-muted)">{formatNumber(count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-(--border)/50">
                    <div className="h-2 rounded-full bg-(--chart-1)" style={{ width: `${Math.max(2, (count / typeMax) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState Icon={MessageSquare} title="No messages sent yet" />
          )}
        </Panel>

        {/* CHATS: counts only, never content */}
        <Panel
          className="lg:col-span-2"
          title={`Chats (${conversations.length})`}
          action={
            <span className="flex items-center gap-1 text-[11px] text-(--text-muted)">
              <Lock size={12} /> Messages are private
            </span>
          }
        >
          {conversations.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-(--border) text-xs text-(--text-muted)">
                  <tr>
                    <th className="px-4 py-2 font-medium">Chat</th>
                    <th className="px-3 py-2 text-right font-medium">Members</th>
                    <th className="px-3 py-2 text-right font-medium">Messages</th>
                    <th className="px-3 py-2 text-right font-medium">Sent by {user.name.split(" ")[0]}</th>
                    <th className="px-4 py-2 font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border)">
                  {conversations.map((conv) => (
                    <tr key={conv.id}>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          {conv.type === "GROUP" ? (
                            <Users size={14} className="shrink-0 text-(--text-muted)" aria-label="Group" />
                          ) : (
                            <UserIcon size={14} className="shrink-0 text-(--text-muted)" aria-label="Direct chat" />
                          )}
                          {conv.otherUserId ? (
                            <Link to={`/admin/users/${conv.otherUserId}`} className="truncate hover:underline">{conv.name}</Link>
                          ) : (
                            <span className="truncate">{conv.name}</span>
                          )}
                          {conv.memberRole === "ADMIN" && conv.type === "GROUP" && (
                            <span className="text-[10px] text-(--text-muted)">(group admin)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{conv.memberCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(conv.totalMessages)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(conv.sentByUser)}</td>
                      <td className="px-4 py-2 text-xs text-(--text-muted)">{timeAgo(conv.lastMessageAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState Icon={Inbox} title="No chats yet" />
          )}
        </Panel>
      </div>

      <Panel title="Admin history for this account" className="mt-4">
        {history.length ? (
          <ul className="divide-y divide-(--border)">
            {history.map((entry) => (
              <AuditEntry key={entry.id} entry={{ ...entry, target: user }} />
            ))}
          </ul>
        ) : (
          <EmptyState Icon={Inbox} title="No admin actions yet" text={`Joined ${formatDate(user.createdAt)}.`} />
        )}
      </Panel>

      {dialog}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && setConfirm(null)}>
          <div role="dialog" aria-modal="true" aria-label={confirm.title} className="w-full max-w-md rounded-t-2xl border border-(--border) bg-(--panel-bg) p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="text-base font-semibold">{confirm.title}</h2>
            <p className="mt-2 text-sm text-(--text-muted)">{confirm.text}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={buttonStyles.ghost} disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className={buttonStyles.primary} disabled={busy} onClick={runConfirm}>
                {busy ? "Saving..." : confirm.button}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BackLink() {
  return (
    <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-(--text-muted) hover:text-(--text-primary)">
      <ArrowLeft size={16} /> All users
    </Link>
  );
}
