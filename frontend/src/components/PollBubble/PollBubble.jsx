import { BarChart2, Circle, CheckCircle2, Square, CheckSquare } from "lucide-react";

export default function PollBubble({ poll, isOwn, currentUserId, onVote }) {
  if (!poll) return null;

  const me = Number(currentUserId);

  // number of different people who voted
  const totalVoters = new Set(poll.options.flatMap((o) => o.voterIds)).size;

  const mutedText = isOwn ? "text-white/70" : "text-(--text-muted)";
  const trackColor = isOwn ? "bg-black/20" : "bg-white/5";
  const fillColor = isOwn ? "bg-white/30" : "bg-(--accent)/40";

  return (
    <div className="w-56 sm:w-72">
      {/* Header */}
      <div className={`mb-1.5 flex items-center gap-1.5 text-[11px] ${mutedText}`}>
        <BarChart2 size={14} />
        <span>Poll</span>
      </div>

      <p className="text-sm font-medium break-words">{poll.question}</p>
      <p className={`mb-2.5 mt-0.5 text-[11px] ${mutedText}`}>
        {poll.closed
          ? "Poll closed"
          : poll.allowMultiple
          ? "Select one or more"
          : "Select one"}
      </p>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {poll.options.map((option) => {
          const count = option.voterIds.length;
          const voted = option.voterIds.some((id) => Number(id) === me);
          const percent = totalVoters ? Math.round((count / totalVoters) * 100) : 0;

          const Icon = poll.allowMultiple
            ? voted
              ? CheckSquare
              : Square
            : voted
            ? CheckCircle2
            : Circle;

          return (
            <button
              key={option.id}
              type="button"
              disabled={poll.closed}
              onClick={() => onVote?.(poll.id, option.id)}
              className={`relative w-full overflow-hidden rounded-lg text-left ${trackColor} transition active:scale-[0.99] disabled:cursor-default`}
            >
              {/* vote bar */}
              <span
                className={`absolute inset-y-0 left-0 ${fillColor} transition-all duration-300`}
                style={{ width: `${percent}%` }}
              />

              <span className="relative flex items-center gap-2 px-2.5 py-2">
                <Icon size={16} className={voted ? "" : mutedText} />
                <span className="flex-1 text-[13px] break-words">{option.text}</span>
                <span className="text-xs font-medium">{count}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className={`mt-2 text-[11px] ${mutedText}`}>
        {totalVoters} {totalVoters === 1 ? "vote" : "votes"}
      </p>
    </div>
  );
}