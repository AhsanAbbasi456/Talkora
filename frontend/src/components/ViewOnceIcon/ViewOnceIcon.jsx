// The "1" icon used for view-once, like WhatsApp
export default function ViewOnceIcon({ on, size = 26 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition ${
        on
          ? "border-(--accent) bg-(--accent) text-[#F8FAFC]"
          : "border-dashed border-current"
      }`}
    >
      1
    </span>
  );
}
