import { getAvatarColor } from "./avatarColor";

// Shows the photo, or a colored circle with the first letter of the name.
export default function Avatar({ p, size = "w-10 h-10", text = "text-sm" }) {
  return p?.avatarUrl ? (
    <img
      src={p.avatarUrl}
      alt=""
      className={`${size} rounded-full object-cover shrink-0 border border-(--border)`}
    />
  ) : (
    <div
      className={`${size} ${text} rounded-full flex items-center justify-center font-semibold text-[#F8FAFC] shrink-0`}
      style={{ backgroundColor: getAvatarColor(p?.id) }}
    >
      {p?.name?.[0]?.toUpperCase() || "U"}
    </div>
  );
}