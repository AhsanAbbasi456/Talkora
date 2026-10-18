import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Check, Minus, Sparkles, Lock, Wallet, FlaskConical, CircleAlert, Landmark, CreditCard } from "lucide-react";
import { api } from "../../utils/api";
import PlusShell from "./PlusShell";
import { formatPkr } from "./plusInfo";

const FREE_FEATURES = [
  { text: "Messages, photos, voice notes & calls", included: true },
  { text: "View-once photos and voice notes", included: true },
  { text: "10 Talkora AI questions per day", included: true },
  { text: "Files up to 10 MB", included: true },
  { text: "Summarize & Translate", included: false },
];

const PROVIDER_ICONS = { SAFEPAY: CreditCard, JAZZCASH: Wallet, MANUAL: Landmark, TEST: FlaskConical };

// Sends the browser to the payment company's page with a signed form
const submitForm = (url, fields) => {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
};

const untilLabel = (date) => new Date(date).toLocaleDateString([], { dateStyle: "long" });

export default function UpgradePage() {
  const { token } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [provider, setProvider] = useState(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/payments/plans", token)
      .then((result) => {
        setData(result);
        setProvider(result.providers[0]?.id || null);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  const plan = data?.plans[0];
  const me = data?.me;
  const chosen = data?.providers.find((p) => p.id === provider);

  const pay = async () => {
    setPaying(true);
    setError("");
    try {
      const { checkout } = await api("/payments/checkout", token, "POST", { plan: plan.id, provider });
      if (checkout.type === "form") return submitForm(checkout.url, checkout.fields);
      const url = new URL(checkout.url);
      // our own test checkout page stays inside the app
      if (url.origin === window.location.origin) return navigate(url.pathname + url.search);
      window.location.assign(checkout.url);
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  };

  return (
    <PlusShell>
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          <Sparkles size={13} /> Talkora Plus
        </span>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Do more with Talkora</h1>
        <p className="mt-2 text-sm text-(--text-muted)">
          Pay once for 30 days. No auto-renew, no surprises.
        </p>
      </div>

      {error && (
        <p className="mx-auto mb-6 flex max-w-3xl items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          <CircleAlert size={16} /> {error}
        </p>
      )}

      {!data ? (
        !error && <p className="text-center text-sm text-(--text-muted)">Loading plans…</p>
      ) : (
        <>
          {/* PLANS */}
          <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-(--border) bg-(--panel-bg) p-6">
              <h2 className="text-lg font-semibold">Free</h2>
              <p className="mt-1 text-3xl font-bold">Rs 0</p>
              <p className="text-xs text-(--text-muted)">forever</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {FREE_FEATURES.map((f) => (
                  <li key={f.text} className={`flex items-start gap-2.5 ${f.included ? "" : "text-(--text-muted)"}`}>
                    {f.included ? (
                      <Check size={16} className="mt-0.5 shrink-0 text-(--accent)" />
                    ) : (
                      <Minus size={16} className="mt-0.5 shrink-0" />
                    )}
                    {f.text}
                  </li>
                ))}
              </ul>
              {!me.isPlus && (
                <p className="mt-6 rounded-lg border border-(--border) py-2 text-center text-sm text-(--text-muted)">
                  Your current plan
                </p>
              )}
            </section>

            <section className="relative rounded-2xl border-2 border-orange-400 bg-(--panel-bg) p-6 shadow-lg">
              <span className="absolute -top-3 right-5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                Best value
              </span>
              <h2 className="flex items-center gap-1.5 text-lg font-semibold">
                <Sparkles size={18} className="text-orange-400" /> {plan.name}
              </h2>
              <p className="mt-1 text-3xl font-bold">{formatPkr(plan.price)}</p>
              <p className="text-xs text-(--text-muted)">for {plan.days} days</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                <li className="flex items-start gap-2.5">
                  <Check size={16} className="mt-0.5 shrink-0 text-(--accent)" />
                  Everything in Free
                </li>
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 font-medium">
                    <Check size={16} className="mt-0.5 shrink-0 text-(--accent)" />
                    {f}
                  </li>
                ))}
              </ul>
              {me.isPlus && (
                <p className="mt-6 rounded-lg bg-(--accent)/12 py-2 text-center text-sm font-medium">
                  Active until {untilLabel(me.plusUntil)}
                </p>
              )}
            </section>
          </div>

          {/* PAYMENT */}
          <section className="mx-auto mt-8 max-w-3xl rounded-2xl border border-(--border) bg-(--panel-bg) p-6">
            <h2 className="text-base font-semibold">{me.isPlus ? "Add 30 more days" : "Choose how to pay"}</h2>

            {data.providers.length === 0 ? (
              <p className="mt-3 text-sm text-(--text-muted)">
                Payments aren't set up yet. Please try again later.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                  {data.providers.map((p) => {
                    const Icon = PROVIDER_ICONS[p.id] || Wallet;
                    const active = provider === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setProvider(p.id)}
                        className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
                          active ? "border-(--accent) bg-(--accent)/8" : "border-(--border) hover:border-(--text-muted)"
                        }`}
                      >
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.id === "JAZZCASH" ? "bg-red-600 text-white" : p.id === "SAFEPAY" ? "bg-blue-700 text-white" : "bg-(--border) text-(--text-primary)"}`}>
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            {p.name}
                            {p.test && (
                              <span className="rounded bg-amber-400/20 px-1.5 py-px text-[10px] font-bold uppercase text-amber-600">
                                Test
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-(--text-muted)">{p.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={pay}
                  disabled={!provider || paying}
                  className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-base font-semibold text-white shadow transition hover:opacity-95 disabled:opacity-60"
                >
                  {paying ? "Opening secure payment…" : `Pay ${formatPkr(plan.price)}${chosen ? ` with ${chosen.name}` : ""}`}
                </button>

                <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs text-(--text-muted)">
                  <Lock size={13} className="mt-px shrink-0" />
                  {provider === "MANUAL"
                    ? "You send the money from your own banking or wallet app. Talkora never sees your PIN or password."
                    : "You pay on the payment company's secure page. Talkora never sees your card, PIN or MPIN."}
                </p>
              </>
            )}
          </section>
        </>
      )}
    </PlusShell>
  );
}
