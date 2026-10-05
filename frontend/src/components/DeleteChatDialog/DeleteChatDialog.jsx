import { useEffect } from "react";

export default function DeleteChatDialog({
  name,
  mode,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!mode) return;

    const handleKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKey, true);

    return () =>
      window.removeEventListener("keydown", handleKey, true);
  }, [mode, onCancel]);

  if (!mode) return null;

  const isDelete = mode === "delete";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-chat-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-xl border border-(--border) bg-(--panel-bg) p-5 shadow-xl"
      >
        <h3
          id="delete-chat-title"
          className="text-base font-semibold text-(--text-primary)"
        >
          {isDelete ? "Delete this chat?" : "Clear this chat?"}
        </h3>

        <p className="mt-1 text-sm text-(--text-muted)">
          {isDelete
            ? `The chat with ${name} will be removed from your list. ${name} keeps their copy.`
            : `All messages will be removed from your side. ${name} keeps their copy.`}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-400 transition hover:bg-red-400/10"
          >
            {isDelete ? "Delete chat" : "Clear chat"}
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