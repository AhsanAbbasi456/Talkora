import { FileText, Image, Camera, Headphones, User, BarChart2, Sticker } from "lucide-react";

const MENU_ITEMS = [
  {
    id: "document",
    label: "Document",
    icon: FileText,
    color: "#7C5CFC",
    accept: ".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip",
  },
  {
    id: "photos",
    label: "Photos & videos",
    icon: Image,
    color: "#3B82F6",
    accept: "image/*,video/*",
  },
  {
    id: "camera",
    label: "Camera",
    icon: Camera,
    color: "#EC4899",
  },
  {
    id: "audio",
    label: "Audio",
    icon: Headphones,
    color: "#F97316",
    accept: "audio/*",
  },
  {
    id: "contact",
    label: "Contact",
    icon: User,
    color: "#3B82F6",
  },
  {
    id: "poll",
    label: "Poll",
    icon: BarChart2,
    color: "#F59E0B",
  },
  {
    id: "sticker",
    label: "New sticker",
    icon: Sticker,
    color: "#10B981",
  },
];

export default function AttachmentMenu({ onSelectFiles, onAction }) {
  const handleClick = (item) => {
    if (item.accept) {
      // Trigger a real file picker for anything that takes a file
      const input = document.createElement("input");
      input.type = "file";
      input.accept = item.accept;
      input.multiple = item.id === "photos";
      input.onchange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) onSelectFiles?.(item.id, files);
      };
      input.click();
    } else {
      // Camera / Contact / Poll / Sticker — no file input, just notify parent
      onAction?.(item.id);
    }
  };

  return (
    <div className="w-52 rounded-xl border border-(--border) bg-(--panel-bg) shadow-xl overflow-hidden py-1.5">
      {MENU_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleClick(item)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition text-left"
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: item.color }}
            >
              <Icon size={16} className="text-white" />
            </span>
            <span className="text-sm text-(--text-primary)">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}   