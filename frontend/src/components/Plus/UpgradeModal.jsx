import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Sparkles, Check, X } from "lucide-react";
import { closeUpgrade } from "../../redux/planSlice";
import { PLUS_PRICE_LABEL, PLUS_FEATURES } from "./plusInfo";

// Headline for the feature the user just tried
const HEADLINES = {
  Summarize: "Summarize chats with Talkora Plus",
  Translate: "Translate messages with Talkora Plus",
  "Large files": "Send files up to 50 MB with Talkora Plus",
  "Talkora AI": "Get unlimited Talkora AI with Plus",
};

// Opens when a Free user tries a Plus feature (planSlice.upgradeFeature)
export default function UpgradeModal() {
  const feature = useSelector((state) => state.plan.upgradeFeature);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const close = () => dispatch(closeUpgrade());

  useEffect(() => {
    if (!feature) return;
    const onKey = (e) => e.key === "Escape" && dispatch(closeUpgrade());
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [feature, dispatch]);

  if (!feature) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        className="w-full max-w-sm overflow-hidden rounded-t-2xl border border-(--border) bg-(--panel-bg) shadow-2xl sm:rounded-2xl"
      >
        <div className="relative bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 px-5 pb-5 pt-6 text-white">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X size={18} />
          </button>
          <Sparkles size={26} />
          <h2 id="upgrade-title" className="mt-2 text-lg font-bold leading-snug">
            {HEADLINES[feature] || `${feature} is a Talkora Plus feature`}
          </h2>
          <p className="mt-1 text-sm text-white/90">{PLUS_PRICE_LABEL}</p>
        </div>

        <ul className="space-y-2.5 px-5 py-4 text-sm text-(--text-primary)">
          {PLUS_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-(--accent)" />
              {f}
            </li>
          ))}
        </ul>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-lg border border-(--border) py-2.5 text-sm font-medium text-(--text-primary) hover:bg-(--border)"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              navigate("/upgrade");
            }}
            className="flex-[2] rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 py-2.5 text-sm font-semibold text-white shadow hover:opacity-95"
          >
            Upgrade to Plus
          </button>
        </div>
      </div>
    </div>
  );
}
