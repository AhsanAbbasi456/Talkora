import { Link } from "react-router-dom";
import { ACTION_LABELS, ROLE_LABELS, formatDateTime, timeAgo } from "./adminUtils";

// One line of the audit log: "<admin> suspended <user> · reason · when"
export default function AuditEntry({ entry }) {
  const { actor, target, action, details, createdAt } = entry;

  const extra = [];
  if (action === "ROLE_CHANGED" && details?.to) {
    extra.push(`${ROLE_LABELS[details.from] || details.from} → ${ROLE_LABELS[details.to] || details.to}`);
  }
  if (action === "PLUS_GRANTED" && details?.days) extra.push(`${details.days} days`);
  if (details?.until) extra.push(`until ${formatDateTime(details.until)}`);
  if (details?.reason) extra.push(`“${details.reason}”`);

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
      <p className="min-w-0 text-(--text-primary)">
        <span className="font-medium">{actor?.name || (details?.via === "script" ? "Setup script" : "Deleted admin")}</span>{" "}
        <span className="text-(--text-muted)">{ACTION_LABELS[action] || action.toLowerCase()}</span>{" "}
        {target ? (
          <Link to={`/admin/users/${target.id}`} className="font-medium hover:underline">
            {target.name}
          </Link>
        ) : (
          <span className="font-medium">a deleted user</span>
        )}
        {extra.length > 0 && <span className="text-(--text-muted)"> · {extra.join(" · ")}</span>}
      </p>
      <time dateTime={createdAt} title={formatDateTime(createdAt)} className="shrink-0 text-xs text-(--text-muted)">
        {timeAgo(createdAt)}
      </time>
    </li>
  );
}
