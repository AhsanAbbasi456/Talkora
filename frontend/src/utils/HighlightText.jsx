export default function HighlightText({ text, query, active }) {
  const q = query?.trim();
  if (!q || !text) return text;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  // with a capture group, odd indexes are the matches
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className={`rounded px-0.5 text-black ${
          active ? "bg-orange-400" : "bg-yellow-300"
        }`}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}