import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";

import { loginUser } from "../../redux/authSlice";
import InputFields from "../InputFields/InputFields";
import AuthLayout from "../authlayout/authlayout";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { error, isAuthenticated } = useSelector(
    (state) => state.auth
  );

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await dispatch(loginUser(formData));

    // Login successful
    if (loginUser.fulfilled.match(result)) {
      navigate("/");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  return (
    <AuthLayout activeTab="login">
      <form onSubmit={handleSubmit}>

        {/* Error message */}
        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Email */}
        <InputFields
          icon={<Mail size={18} />}
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email address"
        />

        {/* Password */}
        <InputFields
          icon={<Lock size={18} />}
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password"
        />

        {/* Remember me / Forgot password */}
        <div className="flex items-center justify-between mb-6 text-sm">
          <label className="flex items-center gap-2 text-gray-400">
            <input
              type="checkbox"
              className="rounded border-white/20 bg-white/5"
            />
            Remember me
          </label>

          <a
            href="#"
            className="text-blue-400 hover:underline"
          >
            Forgot password?
          </a>
        </div>

        {/* Login button */}
        <button
          type="submit"
          className="w-full py-3 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background:
              "linear-gradient(to right, #2563eb, #9333ea)",
          }}
        >
          Login
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6 text-xs uppercase tracking-wider text-gray-500">
          <span className="h-px flex-1 bg-white/10" />

          <span>or continue with</span>

          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={() =>
            window.alert(
              "Google sign-in will be available after OAuth is configured."
            )
          }
          aria-label="Continue with Google"
          className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-white/10 bg-white/5 text-gray-200 transition-colors hover:bg-white/10"
        >
          <span
            className="text-lg font-bold text-[#4285F4]"
            aria-hidden="true"
          >
            G
          </span>

          Continue with Google
        </button>

        {/* Register link */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="text-blue-400 hover:underline"
          >
            Register
          </a>
        </p>

      </form>
    </AuthLayout>
  );
}