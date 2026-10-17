import { useState, useEffect, useRef } from "react";
import { X, Plus, Send } from "lucide-react";

const makeItem = (file) => ({
  file,
  url: URL.createObjectURL(file),
  caption: "",
});

export default function MediaPreviewModal({ files, chatName, onClose, onSend }) {
  const [items, setItems] = useState(() => files.map(makeItem));
  const [active, setActive] = useState(0);
  const [viewOnce, setViewOnce] = useState(false);
  const inputRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // free the preview memory when the window closes
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = items[Math.min(active, items.length - 1)];

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (picked.length) setItems((prev) => [...prev, ...picked.map(makeItem)]);
    e.target.value = "";
  };

  const removeItem = (index) => {
    if (items.length === 1) return onClose();
    URL.revokeObjectURL(items[index].url);
    setItems((prev) => prev.filter((_, i) => i !== index));
    setActive(0);
  };

  const setCaption = (text) =>
    setItems((prev) => prev.map((i) => (i === current ? { ...i, caption: text } : i)));

  const send = () =>
    onSend(items.map((i) => ({ file: i.file, caption: i.caption.trim() })), viewOnce);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--app-bg)">
      {/* TOP BAR */}
      <div className="flex items-center gap-3 px-4 py-3 text-(--text-primary)">
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10">
          <X size={22} />
        </button>
        <span className="text-sm text-(--text-muted)">Send to {chatName}</span>
      </div>

      {/* PREVIEW */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        {current.file.type.startsWith("video/") ? (
          <video key={current.url} src={current.url} controls className="max-h-full max-w-full rounded-md" />
        ) : (
          <img src={current.url} alt="Preview" className="max-h-full max-w-full rounded-md object-contain" />
        )}
      </div>

      {/* CAPTION + "1" */}
      <div className="flex justify-center px-4 py-3">
        <div className="flex w-full max-w-xl items-center gap-2 rounded-xl border border-(--border) bg-(--input-bg) px-4 py-2.5">
          <input
            value={current.caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message"
            className="min-w-0 flex-1 bg-transparent text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setViewOnce((v) => !v)}
            aria-pressed={viewOnce}
            title={viewOnce ? "View once is on" : "Send as view once"}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed text-[11px] font-bold transition ${
              viewOnce
                ? "border-(--accent) bg-(--accent) text-[#F8FAFC]"
                : "border-gray-400 text-gray-400 hover:text-white"
            }`}
          >
            1
          </button>
        </div>
      </div>

      {/* THUMBNAILS + SEND */}
      <div className="flex items-center justify-between border-t border-(--border) bg-(--panel-bg) px-4 py-3">
        <div className="w-12" />
        <div className="flex items-center gap-2 overflow-x-auto">
          {items.map((item, index) => (
            <div key={item.url} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                className={`block h-14 w-14 overflow-hidden rounded-lg border-2 ${
                  item === current ? "border-(--accent)" : "border-transparent opacity-70"
                }`}
              >
                {item.file.type.startsWith("video/") ? (
                  <video src={item.url} className="h-full w-full object-cover" />
                ) : (
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                )}
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                aria-label="Remove"
                className="absolute -right-1 -top-1 hidden rounded-full bg-black/80 p-0.5 text-white group-hover:block"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Add more"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-primary) hover:bg-white/5"
          >
            <Plus size={22} />
          </button>
          <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={addFiles} />
        </div>

        <button
          type="button"
          onClick={send}
          aria-label="Send"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-(--accent) text-[#F8FAFC] hover:scale-105 active:scale-95 transition"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}