import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Copy, Check, Landmark, Smartphone, Zap, ImagePlus, ShieldCheck, CircleAlert } from "lucide-react";
import { api, API_BASE_URL } from "../../utils/api";
import PlusShell from "./PlusShell";
import { formatPkr } from "./plusInfo";

const METHOD_ICONS = { BANK: Landmark, EASYPAISA: Smartphone, JAZZCASH_WALLET: Smartphone, RAAST: Zap };

const SENDER_HINT = {
  BANK: "Name on the bank account you paid from",
  EASYPAISA: "Easypaisa number you paid from (03XX…)",
  JAZZCASH_WALLET: "JazzCash number you paid from (03XX…)",
  RAAST: "Name or Raast ID you paid from",
};

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the value is still visible to copy by hand
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-(--accent) hover:bg-(--border)"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Step 1: send money to one of our accounts. Step 2: tell us the transaction ID + screenshot.
export default function ManualCheckout() {
  const { orderId } = useParams();
  const { token } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [method, setMethod] = useState(null);
  const [tid, setTid] = useState("");
  const [sender, setSender] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/payments/orders/${orderId}/manual`, token)
      .then((result) => {
        // already submitted / paid / failed: show the result instead
        if (result.order.status !== "PENDING") return navigate(`/billing/result?order=${orderId}`, { replace: true });
        setData(result);
        setMethod(result.accounts[0]?.method || null);
      })
      .catch((err) => setError(err.message));
  }, [orderId, token, navigate]);

  // preview of the chosen screenshot; the old preview is freed when a new one is picked
  const previewRef = useRef(null);
  useEffect(() => () => previewRef.current && URL.revokeObjectURL(previewRef.current), []);
  const pickFile = (picked) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = picked ? URL.createObjectURL(picked) : null;
    setFile(picked);
    setPreview(previewRef.current);
  };

  const account = data?.accounts.find((a) => a.method === method);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file) return setError("Attach a screenshot of your payment receipt.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("method", method);
      form.append("transactionId", tid.trim());
      form.append("sender", sender.trim());
      form.append("proof", file);
      const res = await fetch(`${API_BASE_URL}/payments/orders/${orderId}/manual-proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.message || "Could not submit. Please try again.");
      navigate(`/billing/result?order=${orderId}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-(--border) bg-(--input-bg) px-3 py-2.5 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-(--accent) focus:outline-none";

  return (
    <PlusShell back={{ to: "/upgrade", label: "Other payment methods" }}>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold">Pay by transfer</h1>
        <p className="mt-1 text-sm text-(--text-muted)">
          Send the money from your own app, then tell us the transaction ID. We check it and turn on Plus.
        </p>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            <CircleAlert size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {data && (
          <>
            {/* STEP 1 */}
            <section className="mt-6 rounded-2xl border border-(--border) bg-(--panel-bg) p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-(--accent) text-xs text-[#F8FAFC]">1</span>
                Send exactly {formatPkr(data.order.amount)}
              </h2>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Where to send">
                {data.accounts.map((a) => {
                  const Icon = METHOD_ICONS[a.method] || Landmark;
                  return (
                    <button
                      key={a.method}
                      type="button"
                      role="tab"
                      aria-selected={method === a.method}
                      onClick={() => setMethod(a.method)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                        method === a.method
                          ? "border-(--accent) bg-(--accent)/12 font-medium"
                          : "border-(--border) text-(--text-muted) hover:text-(--text-primary)"
                      }`}
                    >
                      <Icon size={15} /> {a.label}
                    </button>
                  );
                })}
              </div>

              {account && (
                <dl className="mt-4 divide-y divide-(--border) rounded-xl border border-(--border) bg-(--app-bg)">
                  {account.details.map((d) => (
                    <div key={d.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <dt className="text-xs text-(--text-muted)">{d.name}</dt>
                        <dd className="break-all font-medium">{d.value}</dd>
                      </div>
                      <CopyButton value={d.value} label={d.name} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <dt className="text-xs text-(--text-muted)">Amount</dt>
                      <dd className="text-lg font-bold">{formatPkr(data.order.amount)}</dd>
                    </div>
                    <CopyButton value={String(data.order.amount)} label="amount" />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <dt className="text-xs text-(--text-muted)">Reference (write it in the payment note if your app allows)</dt>
                      <dd className="font-mono text-sm">{data.order.id}</dd>
                    </div>
                    <CopyButton value={data.order.id} label="reference" />
                  </div>
                </dl>
              )}
            </section>

            {/* STEP 2 */}
            <form onSubmit={submit} className="mt-4 rounded-2xl border border-(--border) bg-(--panel-bg) p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-(--accent) text-xs text-[#F8FAFC]">2</span>
                I've sent it, here are the details
              </h2>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-medium text-(--text-muted)">Transaction ID (TID) from your receipt</span>
                <input
                  value={tid}
                  onChange={(e) => setTid(e.target.value)}
                  required
                  minLength={6}
                  maxLength={40}
                  placeholder="e.g. 041234567890"
                  className={`${input} font-mono uppercase placeholder:normal-case`}
                />
              </label>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-medium text-(--text-muted)">{SENDER_HINT[method] || "Sent from"}</span>
                <input value={sender} onChange={(e) => setSender(e.target.value)} required maxLength={80} className={input} />
              </label>

              <div className="mt-3">
                <span className="mb-1.5 block text-xs font-medium text-(--text-muted)">Screenshot of the receipt</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-(--border) p-3 hover:border-(--accent)">
                  {preview ? (
                    <img src={preview} alt="Receipt preview" className="h-16 w-16 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-md bg-(--app-bg) text-(--text-muted)">
                      <ImagePlus size={22} />
                    </span>
                  )}
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">{file ? file.name : "Choose image"}</span>
                    <span className="text-xs text-(--text-muted)">JPG, PNG or WebP · up to 5 MB</span>
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => pickFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-semibold text-white shadow hover:opacity-95 disabled:opacity-60"
              >
                {busy ? "Submitting…" : "Submit for verification"}
              </button>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-(--text-muted)">
                <ShieldCheck size={14} className="mt-px shrink-0" />
                We check that the money arrived in our account, usually within a few hours. You'll get a notification and an
                email when Plus is on. Each transaction ID can only be used once.
              </p>
            </form>
          </>
        )}
      </div>
    </PlusShell>
  );
}
