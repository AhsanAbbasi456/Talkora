import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  format,
} from "date-fns";

export function formatLastSeen(lastSeen) {
  if (!lastSeen) return "last seen recently";

  const date = new Date(lastSeen);
  const diff = Date.now() - date.getTime();

  if (isToday(date)) {
    if (diff < 60000) return "last seen just now";

    if (diff < 3600000) {
      return `last seen ${formatDistanceToNow(date, {
        addSuffix: true,
      })}`;
    }

    return `last seen today at ${format(date, "h:mm a")}`;
  }

  if (isYesterday(date)) {
    return `last seen yesterday at ${format(date, "h:mm a")}`;
  }

  return `last seen ${format(date, "dd/MM/yyyy")} at ${format(
    date,
    "h:mm a"
  )}`;
}