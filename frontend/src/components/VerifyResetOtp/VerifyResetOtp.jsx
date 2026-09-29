import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, ArrowLeft } from "lucide-react";

export default function VerifyResetOtp() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If user lands here without going through ForgotPassword first, send them back
  useEffect(() => {
    const savedEmail = sessionStorage.getItem("resetEmail");
    if (!savedEmail) {
      navigate("/forgot-password");
      return;
    }
    setEmail(savedEmail);
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/verify-reset-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            otp: otp.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      // Save the verified OTP too — reset-password endpoint needs it again
      sessionStorage.setItem("resetOtp", otp.trim());

      navigate("/reset-password");
    } catch (error) {
      console.error("Verify reset OTP error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/src/assets/images/background.png')] bg-cover bg-center px-4">
      <div className="w-full max-w-[482px] rounded-2xl border border-white/20 bg-[#0d1233]/90 px-7 py-8 shadow-2xl backdrop-blur-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Enter OTP
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            We sent a code to {email}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="relative mb-6">
            <KeyRound
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              required
              className="w-full rounded-lg border border-white/15 bg-white/5 py-4 pl-11 pr-4 tracking-[0.3em] text-white placeholder-gray-500 outline-none transition focus:border-blue-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3.5 text-base font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        <div className="mt-7 text-center">
          <button
            onClick={() => navigate("/forgot-password")}
            className="inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-blue-400"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </div>
    </div>
  );
}