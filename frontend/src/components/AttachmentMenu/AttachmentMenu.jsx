import {
  FileText,
  Image,
  Camera,
  Headphones,
  BarChart2,
  Sticker,
} from "lucide-react";

// `accept` = opens a real file picker. No `accept` = "coming soon" action.
const MENU_ITEMS = [
  {
    id: "document",
    label: "Document",
    icon: FileText,
    color: "#7F66FF",
    accept: ".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip",
  },
  {
    id: "photos",
    label: "Photos & videos",
    icon: Image,
    color: "#007BFC",
    accept: "image/*,video/*",
  },
  { id: "camera", label: "Camera", icon: Camera, color: "#FF2E74", ready: true },
  { id: "audio", label: "Audio", icon: Headphones, color: "#FA6533", accept: "audio/*" },
  { id: "poll", label: "Poll", icon: BarChart2, color: "#FFBC38", ready: true },
  { id: "sticker", label: "New sticker", icon: Sticker, color: "#02A698" },
];

export default function AttachmentMenu({ onSelectFiles, onAction }) {
  const handleClick = (item) => {
    if (!item.accept) {
      onAction?.(item.id); // Camera / Poll / Sticker
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = item.accept;
    input.multiple = item.id === "photos";
    input.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length) onSelectFiles?.(item.id, files);
    };
    input.click();
  };

  return (
    <>
      <style>{`
        @keyframes attach-pop {
          from { opacity: 0; transform: translateY(8px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        className="w-56 origin-bottom-left rounded-2xl border border-(--border) bg-(--panel-bg) p-2 shadow-2xl"
        style={{ animation: "attach-pop 160ms ease-out" }}
      >
        {MENU_ITEMS.map(({ id, label, icon: Icon, color, accept,ready }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleClick({ id, accept })}
            className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/8 active:bg-white/12"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-md transition-transform duration-150 group-hover:scale-110"
              style={{ backgroundColor: color }}
            >
              <Icon size={19} className="text-white" strokeWidth={2.2} />
            </span>

            <span className="flex-1 text-[14.5px] text-(--text-primary)">{label}</span>

            {!accept &&  !ready &&(
              <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-(--text-muted)">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}