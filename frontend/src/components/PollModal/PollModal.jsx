import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

export default function PollModal({ onCreate, onClose }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [error, setError] = useState("");

  const updateOption = (index, value) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
    setError("");
  };

  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (index) => {
    if (options.length > MIN_OPTIONS) {
      setOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = () => {
    const cleanQuestion = question.trim();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!cleanQuestion) return setError("Enter a question");
    if (new Set(cleanOptions).size < MIN_OPTIONS) {
      return setError("Add at least 2 different options");
    }

    onCreate?.({
      question: cleanQuestion,
      options: [...new Set(cleanOptions)],
      allowMultiple,
    });
  };

  const inputClass =
    "w-full rounded-xl border border-(--border) bg-(--input-bg) px-3 py-2.5 text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-(--border) bg-(--panel-bg) shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-(--border) px-4 py-3">
          <p className="text-sm font-medium text-(--text-primary)">Create poll</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {/* Question */}
          <label className="mb-1.5 block text-xs text-(--text-muted)">Question</label>
          <input
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setError("");
            }}
            maxLength={200}
            placeholder="Where should we eat tonight?"
            className={inputClass}
          />

          {/* Options */}
          <label className="mb-1.5 mt-4 block text-xs text-(--text-muted)">Options</label>
          <div className="flex flex-col gap-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  maxLength={100}
                  placeholder={`Option ${index + 1}`}
                  className={inputClass}
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-red-400"
                    aria-label={`Remove option ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-(--border) px-3 py-2.5 text-sm text-(--text-muted) transition hover:bg-white/5 hover:text-(--text-primary)"
            >
              <Plus size={16} /> Add option
            </button>
          )}

          {/* Allow multiple answers */}
          <button
            type="button"
            onClick={() => setAllowMultiple((v) => !v)}
            className="mt-4 flex w-full items-center justify-between text-sm text-(--text-primary)"
          >
            <span>Allow multiple answers</span>
            <span
              className={`relative h-5 w-9 rounded-full transition ${
                allowMultiple ? "bg-(--accent)" : "bg-slate-600"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  allowMultiple ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 border-t border-(--border) px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-(--text-muted) transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-full bg-(--accent) px-5 py-2 text-sm font-medium text-[#F8FAFC] transition hover:scale-105 active:scale-95"
          >
            Send poll
          </button>
        </div>
      </div>
    </div>
  );
}