import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Check, X, Eye, EyeOff } from "lucide-react";

// Password rules used for the checklist UI
const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { label: "One special character (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export default function ResetPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Show/hide password toggles
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check password strength (score-based label, used for submit gating)
  const checkPasswordStrength = (password) => {
    if (!password) {
      return "";
    }

    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {
      return "Weak";
    }

    if (score <= 4) {
      return "Medium";
    }

    return "Strong";
  };

  // Visual meta (bar width/color) for the strength label
  const getStrengthMeta = (strength) => {
    switch (strength) {
      case "Weak":
        return { color: "bg-red-500", textColor: "text-red-400", widthPct: 33 };
      case "Medium":
        return { color: "bg-yellow-500", textColor: "text-yellow-400", widthPct: 66 };
      case "Strong":
        return { color: "bg-green-500", textColor: "text-green-400", widthPct: 100 };
      default:
        return { color: "bg-slate-700", textColor: "text-gray-400", widthPct: 0 };
    }
  };

  // Must have come from the OTP verification step
  useEffect(() => {
    const savedEmail = sessionStorage.getItem("resetEmail");
    const savedOtp = sessionStorage.getItem("resetOtp");

    if (!savedEmail || !savedOtp) {
      navigate("/forgot-password");
      return;
    }

    setEmail(savedEmail);
    setOtp(savedOtp);
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (passwordStrength !== "Strong") {
      setError(
        "Please create a strong password before continuing."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            otp,
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      // Clean up — no longer needed
      sessionStorage.removeItem("resetEmail");
      sessionStorage.removeItem("resetOtp");

      setSuccess(true);

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Reset password error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const strengthMeta = getStrengthMeta(passwordStrength);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/src/assets/images/background.png')] bg-cover bg-center px-4">
      <div className="w-full max-w-[482px] rounded-2xl border border-white/20 bg-[#0d1233]/90 px-7 py-8 shadow-2xl backdrop-blur-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Reset Password
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Enter your new password below
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            Password reset successfully! Redirecting to login...
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>

            {/* New Password */}
            <div className="relative mb-2">
              <Lock
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="New password"
                value={newPassword}
                onChange={(e) => {
                  const value = e.target.value;

                  setNewPassword(value);
                  setPasswordStrength(
                    checkPasswordStrength(value)
                  );
                }}
                required
                className="w-full rounded-lg border border-white/15 bg-white/5 py-4 pl-11 pr-11 text-white placeholder-gray-500 outline-none transition focus:border-blue-400"
              />

              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                tabIndex={-1}
                aria-label={
                  showNewPassword ? "Hide password" : "Show password"
                }
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Password Strength — bar + checklist */}
            {newPassword && (
              <div className="mt-3 mb-4 space-y-3">
                {/* Strength bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthMeta.color}`}
                      style={{ width: `${strengthMeta.widthPct}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium min-w-[50px] text-right ${strengthMeta.textColor}`}
                  >
                    {passwordStrength}
                  </span>
                </div>

                {/* Checklist */}
                <ul className="space-y-1.5">
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(newPassword);
                    return (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-2 text-sm transition-colors ${
                          passed ? "text-green-400" : "text-slate-500"
                        }`}
                      >
                        {passed ? (
                          <Check size={14} className="shrink-0" />
                        ) : (
                          <X size={14} className="shrink-0" />
                        )}
                        <span>{rule.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Confirm Password */}
            <div className="relative mb-6">
              <Lock
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                required
                className="w-full rounded-lg border border-white/15 bg-white/5 py-4 pl-11 pr-11 text-white placeholder-gray-500 outline-none transition focus:border-blue-400"
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                tabIndex={-1}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={
                loading || passwordStrength !== "Strong"
              }
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3.5 text-base font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}