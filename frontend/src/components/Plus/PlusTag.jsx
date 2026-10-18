import { Sparkles } from "lucide-react";

// Small "✨ Plus" pill shown next to locked features
export default function PlusTag({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white ${className}`}
    >
      <Sparkles size={10} strokeWidth={2.5} />
      Plus
    </span>
  );
}
