import { useState, useRef, useMemo } from "react";
import { Search, Clock } from "lucide-react";

const CATEGORIES = [
  {
    id: "smileys",
    label: "Smileys & People",
    tabIcon: "😀",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "😤", "😡", "😠", "🤬", "👍", "👎", "👏", "🙏", "💪", "🤝", "✌️", "🤞", "👋", "🖐️", "🤙", "👌"],
  },
  {
    id: "animals",
    label: "Animals & Nature",
    tabIcon: "🐶",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐢", "🐍", "🦎", "🐙", "🦑", "🦀", "🐬", "🐳", "🐘", "🦒", "🌸", "🌺", "🌼", "🌻", "🌹", "🍀", "🌳", "🌵"],
  },
  {
    id: "food",
    label: "Food & Drink",
    tabIcon: "🍔",
    emojis: ["🍏", "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🍞", "🥐", "🥖", "🧀", "🍳", "🥞", "🍔", "🍟", "🍕", "🌭", "🌮", "🌯", "🍜", "🍣", "🍩", "🍪", "🎂", "🍰", "🍫", "🍬", "🍭", "🍿", "☕", "🍵", "🧃", "🥤", "🍺", "🍷", "🍸", "🍹"],
  },
  {
    id: "travel",
    label: "Travel & Places",
    tabIcon: "✈️",
    emojis: ["🚗", "🚕", "🚙", "🚌", "🏍️", "🚲", "✈️", "🚀", "🚁", "⛵", "🚤", "🚢", "🚉", "🗺️", "🗼", "🏰", "🏝️", "🏖️", "🏔️", "🌋", "🏕️", "🌆", "🌃", "🌅", "🌄", "🌇", "🌉", "🌌"],
  },
  {
    id: "activities",
    label: "Activities",
    tabIcon: "⚽",
    emojis: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸", "🥊", "🥋", "🎯", "🎮", "🎲", "🎸", "🎹", "🎨", "🎬", "🎤", "🎧", "🏆", "🥇", "🎗️"],
  },
  {
    id: "objects",
    label: "Objects",
    tabIcon: "💡",
    emojis: ["📱", "💻", "⌨️", "🖥️", "🖨️", "📷", "🔋", "💡", "🔦", "📞", "☎️", "📟", "📺", "🕹️", "💿", "📀", "⏰", "⌚", "📅", "📌", "📎", "✂️", "🔑", "🔒", "🔓", "🔨", "🪛", "🧰", "💰", "💳", "✉️", "📦", "📚"],
  },
  {
    id: "symbols",
    label: "Symbols",
    tabIcon: "❤️",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💯", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "✅", "❌", "❗", "❓", "⚠️", "♻️", "🔁", "🔀"],
  },
  {
    id: "flags",
    label: "Flags",
    tabIcon: "🏳️",
    emojis: ["🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🇵🇰", "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇮🇳", "🇩🇪", "🇫🇷", "🇯🇵", "🇨🇳", "🇧🇷", "🇿🇦", "🇸🇦"],
  },
];

const RECENT_KEY = "talkora_recent_emojis";
const MAX_RECENT = 24;

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecent(emoji) {
  const current = getRecent().filter((e) => e !== emoji);
  const updated = [emoji, ...current].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  return updated;
}

export default function EmojiPicker({ onSelect }) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(getRecent());
  const sectionRefs = useRef({});
  const scrollRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    // simple search: matches nothing meaningful without emoji names, so
    // search just narrows within currently loaded emoji chars by category label
    const q = query.toLowerCase();
    return CATEGORIES.filter((c) => c.label.toLowerCase().includes(q)).flatMap((c) => c.emojis);
  }, [query]);

  const handlePick = (emoji) => {
    onSelect(emoji);
    setRecent(saveRecent(emoji));
  };

  const scrollToSection = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="flex flex-col w-80 max-w-[calc(100vw-1.5rem)] h-96 rounded-xl border border-(--border) bg-(--panel-bg) shadow-xl overflow-hidden">
      {/* Search */}
      <div className="px-2.5 py-2 border-b border-(--border)">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-(--text-muted)" size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="w-full pl-8 pr-3 py-1.5 bg-(--input-bg) border border-(--border) rounded-lg text-xs text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filtered ? (
          <div className="grid grid-cols-8 gap-0.5 p-2">
            {filtered.length === 0 ? (
              <p className="col-span-8 text-center text-xs text-(--text-muted) py-6">No emoji found</p>
            ) : (
              filtered.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => handlePick(emoji)}
                  className="text-xl leading-none flex items-center justify-center h-9 w-9 rounded-lg hover:bg-white/10 transition"
                >
                  {emoji}
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            {recent.length > 0 && (
              <div ref={(el) => (sectionRefs.current.recent = el)}>
                <div className="sticky top-0 z-10 bg-(--panel-bg)/95 backdrop-blur px-3 py-1.5 flex items-center gap-1.5">
                  <Clock size={12} className="text-(--text-muted)" />
                  <span className="text-[11px] font-medium text-(--text-muted) uppercase tracking-wide">
                    Recently used
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-0.5 px-2 pb-2">
                  {recent.map((emoji, i) => (
                    <button
                      key={`recent-${emoji}-${i}`}
                      type="button"
                      onClick={() => handlePick(emoji)}
                      className="text-xl leading-none flex items-center justify-center h-9 w-9 rounded-lg hover:bg-white/10 transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {CATEGORIES.map((cat) => (
              <div key={cat.id} ref={(el) => (sectionRefs.current[cat.id] = el)}>
                <div className="sticky top-0 z-10 bg-(--panel-bg)/95 backdrop-blur px-3 py-1.5">
                  <span className="text-[11px] font-medium text-(--text-muted) uppercase tracking-wide">
                    {cat.label}
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-0.5 px-2 pb-2">
                  {cat.emojis.map((emoji, i) => (
                    <button
                      key={`${cat.id}-${emoji}-${i}`}
                      type="button"
                      onClick={() => handlePick(emoji)}
                      className="text-xl leading-none flex items-center justify-center h-9 w-9 rounded-lg hover:bg-white/10 transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom category tab bar — WhatsApp-style quick jump */}
      <div className="flex items-center justify-between border-t border-(--border) px-1.5 py-1.5 bg-(--input-bg)">
        <button
          type="button"
          onClick={() => scrollToSection("recent")}
          className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition"
          title="Recently used"
        >
          <Clock size={15} className="text-(--text-muted)" />
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => scrollToSection(cat.id)}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition text-base leading-none"
            title={cat.label}
          >
            {cat.tabIcon}
          </button>
        ))}
      </div>
    </div>
  );
}