export default function ChatBubble({ message, isOwn }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
          isOwn
            ? "bg-[var(--accent)] text-[#F8FAFC] rounded-br-sm"
            : "bg-[var(--panel-bg)] text-[var(--text-primary)] border border-[var(--border)] rounded-bl-sm"
        }`}
      >
        <p>{message.text}</p>
        <span
          className={`block text-[10px] mt-1 ${
            isOwn ? "text-blue-100" : "text-[var(--text-muted)]"
          }`}
        >
          {message.time}
        </span>
      </div>
    </div>
  );
}