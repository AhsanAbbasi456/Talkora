export default function ChatBubble({
  message,
  isOwn,
  isLastInGroup = true,
}) {
  const messageText = message.body || message.text || "";

  const messageTime = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : message.time || "";

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} ${
        isLastInGroup ? "mb-2" : "mb-0.5"
      }`}
    >
      <div
        className={`max-w-[75%] sm:max-w-[65%] px-2.5 py-1.5 text-[14.2px] leading-[1.35] rounded-lg ${
          isOwn
            ? `bg-(--accent) text-[#F8FAFC] ${
                isLastInGroup ? "rounded-br-none" : ""
              }`
            : `bg-(--panel-bg) text-(--text-primary) border border-(--border) ${
                isLastInGroup ? "rounded-bl-none" : ""
              }`
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{messageText}</p>

        <span
          className={`block text-[10px] leading-none mt-1 text-right ${
            isOwn ? "text-indigo-100" : "text-(--text-muted)"
          }`}
        >
          {messageTime}
        </span>
      </div>
    </div>
  );
}