export default function ChatBubble({ message, isOwn, avatarColor, name }) {
  return (
    <div
      className={`flex ${
        isOwn ? "justify-end" : "justify-start"
      } mb-3 gap-2`}
    >
      {!isOwn && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 self-end"
          style={{ backgroundColor: avatarColor || "#10B981" }}
        >
          {name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)}
        </div>
      )}

      <div
        className={`max-w-[75%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
          isOwn
            ? "bg-(--accent) text-[#F8FAFC] rounded-br-sm"
            : "bg-(--panel-bg) text-(--text-primary) border border-(--border) rounded-bl-sm"
        }`}
      >
        <p>{message.text}</p>

        <span
          className={`block text-[10px] mt-1 ${
            isOwn ? "text-blue-100" : "text-(--text-muted)"
          }`}
        >
          {message.time}
        </span>
      </div>
    </div>
  );
}