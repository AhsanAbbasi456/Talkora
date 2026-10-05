import { useEffect } from "react";

export default function DeleteMessageDialog({
  message,
  isOwn,
  onDelete,
  onCancel,
}) {
  useEffect(() => {
    if (!message) return;

    const handleKey = (e) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleKey);

    return () => document.removeEventListener("keydown", handleKey);
  }, [message, onCancel]);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-message-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-xl border border-(--border) bg-(--panel-bg) p-5 shadow-xl"
      >
        <h3
          id="delete-message-title"
          className="text-base font-semibold text-(--text-primary)"
        >
          Delete message?
        </h3>

        <p className="mt-1 text-sm text-(--text-muted)">
          {isOwn
            ? "Deleting for everyone removes it for both of you."
            : "This removes it from your chat only. They can still see it."}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {isOwn && (
            <button
              type="button"
              onClick={() => onDelete("everyone")}
              className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-400 transition hover:bg-red-400/10"
            >
              Delete for everyone
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete("me")}
            className="rounded-lg border border-(--border) px-3 py-2 text-sm text-(--text-primary) transition hover:bg-white/5"
          >
            Delete for me
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-(--text-muted) transition hover:text-(--text-primary)"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}