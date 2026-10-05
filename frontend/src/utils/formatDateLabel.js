import { isToday, isYesterday, format } from "date-fns";

export function formatDateLabel(value) {
  const date = new Date(value);

  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";

  return format(date, "d MMMM yyyy");
}