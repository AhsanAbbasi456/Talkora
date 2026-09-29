import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import {
  GoogleOAuthProvider,
  useGoogleLogin,
} from "@react-oauth/google";

import {
  loginUser,
  googleLogin,
} from "../../redux/authSlice";

import InputFields from "../InputFields/InputFields";
import AuthLayout from "../authlayout/authlayout";

function LoginForm() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { loading } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ==========================================
  // INPUT CHANGE
  // ==========================================
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setError("");
  };

  // ==========================================
  // NORMAL EMAIL/PASSWORD LOGIN
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const resultAction = await dispatch(loginUser(formData));

    if (loginUser.fulfilled.match(resultAction)) {
      navigate("/home");
      return;
    }

    setError(resultAction.payload || "Login failed");
  };

  // ==========================================
  // GOOGLE LOGIN
  // ==========================================
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError("");

      console.log("Google token received:", tokenResponse);

      const resultAction = await dispatch(
        googleLogin(tokenResponse.access_token)
      );

      if (googleLogin.fulfilled.match(resultAction)) {
        navigate("/home");
        return;
      }

      setError(
        resultAction.payload ||
          "Google login failed. Please try again."
      );
    },

    onError: () => {
      setError("Google login failed. Please try again.");
    },
  });

  return (
    <AuthLayout activeTab="login">
      <form onSubmit={handleSubmit} autoComplete="off">
        {/* Error message */}
        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* ==========================================
            EMAIL
        ========================================== */}
        <InputFields
          icon={<Mail size={18} />}
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email address"
          autoComplete="off"
        />

        {/* ==========================================
            PASSWORD
        ========================================== */}
        <div className="relative">
          <InputFields
            icon={<Lock size={18} />}
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Password"
            autoComplete="off"
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword((prev) => !prev)
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
            tabIndex={-1}
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
          >
            {showPassword ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>

        {/* ==========================================
            REMEMBER / FORGOT PASSWORD
        ========================================== */}
        <div className="flex items-center justify-between mb-6 text-sm">
          <label className="flex items-center gap-2 text-gray-400">
            <input
              type="checkbox"
              className="rounded border-white/20 bg-white/5"
            />
            Remember me
          </label>

          <Link
            to="/forgot-password"
            className="text-blue-400 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* ==========================================
            NORMAL LOGIN BUTTON
        ========================================== */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          style={{
            background:
              "linear-gradient(to right, #2563eb, #9333ea)",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* ==========================================
            DIVIDER
        ========================================== */}
        <div className="flex items-center gap-3 my-6 text-xs uppercase tracking-wider text-gray-500">
          <span className="h-px flex-1 bg-white/10" />

          <span>or continue with</span>

          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* ==========================================
            GOOGLE LOGIN BUTTON
        ========================================== */}
        <button
          type="button"
          onClick={() => handleGoogleLogin()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-white/10 bg-white/5 text-gray-200 transition-all hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
        >
          <span
            className="text-lg font-bold text-[#4285F4]"
            aria-hidden="true"
          >
            G
          </span>

          <span>Continue with Google</span>
        </button>

        {/* ==========================================
            REGISTER
        ========================================== */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="text-blue-400 hover:underline"
          >
            Register
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ==========================================
// GOOGLE OAUTH PROVIDER
// ==========================================
export default function Login() {
  return (
    <GoogleOAuthProvider
      clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
    >
      <LoginForm />
    </GoogleOAuthProvider>
  );
}