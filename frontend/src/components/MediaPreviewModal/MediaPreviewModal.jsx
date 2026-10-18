import { useState, useEffect, useRef } from "react";
import { X, Plus, Send } from "lucide-react";
import ViewOnceIcon from "../ViewOnceIcon/ViewOnceIcon";

const isVideo = (file) => file.type.startsWith("video/");

let nextId = 0;
const makeItem = (file) => ({ id: nextId++, file, caption: "" });

// Shows a picked file. The blob URL is created and freed inside the effect,
// so it stays valid when React StrictMode mounts the component twice in dev.
function LocalMedia({ file, ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return isVideo(file) ? <video ref={ref} {...props} /> : <img ref={ref} alt="" {...props} />;
}

export default function MediaPreviewModal({ files, chatName, onClose, onSend }) {
  const [items, setItems] = useState(() => files.map(makeItem));
  const [active, setActive] = useState(0);
  const [viewOnce, setViewOnce] = useState(false);
  const [toast, setToast] = useState("");
  const inputRef = useRef(null);
  const captionRef = useRef(null);
  const toastTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!viewOnce) captionRef.current?.focus();
  }, [active, viewOnce]);

  const current = items[Math.min(active, items.length - 1)];
  const kind = isVideo(current.file) ? "Video" : "Photo";

  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 2200);
  };

  const toggleViewOnce = () => {
    const next = !viewOnce;
    setViewOnce(next);
    const what = items.length > 1 ? "Media" : kind;
    showToast(next ? `${what} set to view once` : `${what} set to keep in chat`);
  };

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith("image/") || isVideo(f),
    );
    if (picked.length) {
      setItems((prev) => [...prev, ...picked.map(makeItem)]);
      setActive(items.length); // jump to the first new item
    }
    e.target.value = "";
  };

  const removeItem = (index) => {
    if (items.length === 1) return onClose();
    setItems((prev) => prev.filter((_, i) => i !== index));
    setActive((a) => (a >= index && a > 0 ? a - 1 : a));
  };

  const setCaption = (text) =>
    setItems((prev) => prev.map((i) => (i === current ? { ...i, caption: text } : i)));

  // view-once media is sent without captions (the text would stay in the chat)
  const send = () =>
    onSend(
      items.map((i) => ({ file: i.file, caption: viewOnce ? "" : i.caption.trim() })),
      viewOnce,
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Send media to ${chatName}`}
      className="fixed inset-0 z-50 flex flex-col bg-(--app-bg)"
      style={{ animation: "media-preview-in 160ms ease-out" }}
    >
      <style>{`
        @keyframes media-preview-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* TOP BAR */}
      <div className="flex items-center gap-3 border-b border-(--border) bg-(--panel-bg) px-4 py-3 text-(--text-primary)">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-2 hover:bg-white/10"
        >
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current.file.name}</p>
          <p className="truncate text-xs text-(--text-muted)">Send to {chatName}</p>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/40 px-4 py-6">
        <LocalMedia
          key={current.id}
          file={current.file}
          controls={isVideo(current.file)}
          className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
        />

        {toast && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow-lg">
            <ViewOnceIcon on={viewOnce} size={20} />
            {toast}
          </div>
        )}
      </div>

      {/* CAPTION + "1" */}
      <div className="flex justify-center px-4 py-3">
        <div className="flex w-full max-w-xl items-center gap-2 rounded-xl border border-(--border) bg-(--input-bg) px-4 py-2.5">
          <input
            ref={captionRef}
            value={viewOnce ? "" : current.caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={viewOnce}
            placeholder={viewOnce ? "Captions are off for view once" : "Add a caption"}
            className="min-w-0 flex-1 bg-transparent text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={toggleViewOnce}
            aria-pressed={viewOnce}
            title={viewOnce ? "View once is on" : "Send as view once"}
            className={`rounded-full transition ${
              viewOnce ? "" : "text-(--text-muted) hover:text-(--text-primary)"
            }`}
          >
            <ViewOnceIcon on={viewOnce} />
          </button>
        </div>
      </div>

      {/* THUMBNAILS + SEND */}
      <div className="flex items-center gap-3 border-t border-(--border) bg-(--panel-bg) px-4 py-3">
        <div className="hidden w-12 sm:block" />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto py-1">
          {items.map((item, index) => (
            <div key={item.id} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show ${item.file.name}`}
                className={`block h-14 w-14 overflow-hidden rounded-lg border-2 ${
                  item === current ? "border-(--accent)" : "border-transparent opacity-70"
                }`}
              >
                <LocalMedia file={item.file} className="h-full w-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                aria-label="Remove"
                className="absolute -right-1 -top-1 rounded-full bg-black/80 p-0.5 text-white opacity-0 transition group-hover:opacity-100 max-md:opacity-100"
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
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={addFiles}
          />
        </div>

        <button
          type="button"
          onClick={send}
          aria-label="Send"
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-(--accent) text-[#F8FAFC] transition hover:scale-105 active:scale-95"
        >
          <Send size={20} />
          {items.length > 1 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-semibold text-black">
              {items.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
