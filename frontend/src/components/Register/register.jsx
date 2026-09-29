import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { User, Mail, Lock, Check, X, Eye, EyeOff } from "lucide-react";

import { registerUser } from "../../redux/authSlice";
import InputFields from "../InputFields/InputFields";
import AuthLayout from "../authlayout/authlayout";

// Password rules used for the checklist UI
const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { label: "One special character (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export default function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    picture: "",
  });

  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [imageLoading, setImageLoading] = useState(false);

  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState("");

  // Show/hide password toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
    });

    // Check password strength
    if (name === "password") {
      setPasswordStrength(checkPasswordStrength(value));
    }

    setError("");
  };

  // Upload profile picture to Cloudinary
  const handleImageChange = async (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    // Check image size
    if (file.size > 7 * 1024 * 1024) {
      setError("Profile picture must be smaller than 7 MB");
      e.target.value = "";
      return;
    }

    setError("");
    setImageLoading(true);

    // Local preview
    const imageUrl = URL.createObjectURL(file);
    setPreview(imageUrl);

    try {
      // STEP 1: Get Cloudinary signature from backend
      const signatureResponse = await fetch(
        "http://localhost:3000/api/cloudinary/signature"
      );

      const signatureData = await signatureResponse.json();

      if (!signatureResponse.ok) {
        throw new Error(
          signatureData.message ||
            "Failed to get Cloudinary signature"
        );
      }

      console.log("Cloudinary signature received");

      // STEP 2: Prepare image upload
      const uploadData = new FormData();

      uploadData.append("file", file);
      uploadData.append("api_key", signatureData.apiKey);
      uploadData.append("timestamp", signatureData.timestamp);
      uploadData.append("signature", signatureData.signature);

      // STEP 3: Upload directly to Cloudinary
      const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
        {
          method: "POST",
          body: uploadData,
        }
      );

      const cloudinaryData = await cloudinaryResponse.json();

      if (!cloudinaryResponse.ok) {
        throw new Error(
          cloudinaryData.error?.message ||
            "Cloudinary upload failed"
        );
      }

      // STEP 4: Get Cloudinary URL
      console.log(
        "Cloudinary URL:",
        cloudinaryData.secure_url
      );

      // STEP 5: Save Cloudinary URL in formData
      setFormData((prevData) => ({
        ...prevData,
        picture: cloudinaryData.secure_url,
      }));

      console.log(
        "Profile picture URL saved:",
        cloudinaryData.secure_url
      );

      setError("");
    } catch (error) {
      console.error("Image upload error:", error);

      setPreview(null);

      setFormData((prevData) => ({
        ...prevData,
        picture: "",
      }));

      setError(
        error.message ||
          "Unable to upload profile picture"
      );
    } finally {
      setImageLoading(false);
    }
  };

  // Request OTP
  const handleRequestOtp = async () => {
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    const email = formData.email.trim().toLowerCase();

    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/request-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Failed to send OTP"
        );
        return;
      }

      setPendingEmail(email);
      setOtpStep(true);
      setResendCooldown(120);
      setError("");
    } catch (error) {
      console.error("OTP error:", error);

      setError(
        "Unable to send OTP. Please try again."
      );
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendLoading) {
      return;
    }

    setResendLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/request-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: pendingEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Failed to resend OTP"
        );
        return;
      }

      setResendCooldown(120);
      setOtp("");
      setError("");
    } catch (error) {
      console.error("Resend OTP error:", error);

      setError(
        "Unable to resend OTP. Please try again."
      );
    } finally {
      setResendLoading(false);
    }
  };

  // Verify OTP and register user
  const handleVerifyOtpAndRegister = async () => {
    if (!otp.trim()) {
      setError("OTP is required");
      return;
    }

    try {
      // STEP 1: Verify OTP
      const verifyResponse = await fetch(
        "http://localhost:3000/api/auth/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: pendingEmail,
            otp: otp.trim(),
          }),
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(
          verifyData.message ||
            "OTP verification failed"
        );
        return;
      }

      console.log("OTP verified successfully");

      // STEP 2: Register user
      console.log("Register data:", {
        name: formData.name,
        email: pendingEmail,
        password: formData.password,
        picture: formData.picture,
      });

      const resultAction = await dispatch(
        registerUser({
          ...formData,
          email: pendingEmail,
          otp: otp.trim(),
        })
      );

      // STEP 3: Registration successful
      if (registerUser.fulfilled.match(resultAction)) {
        console.log("Registration successful");

        navigate("/login");
        return;
      }

      // Registration failed
      setError(
        resultAction.payload ||
          "Registration failed"
      );
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      setError("Registration failed");
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    // Check password strength
    if (passwordStrength !== "Strong") {
      setError(
        "Please create a strong password before continuing."
      );
      return;
    }

    // Check password
    if (
      formData.password !==
      formData.confirmPassword
    ) {
      setError("Passwords do not match");
      return;
    }

    // Wait for image upload
    if (imageLoading) {
      setError(
        "Please wait for the profile picture to finish uploading"
      );
      return;
    }

    // Check name
    if (!formData.name.trim()) {
      setError("Please enter your name");
      return;
    }

    // First click → request OTP
    if (!otpStep) {
      await handleRequestOtp();
      return;
    }

    // Second click → verify OTP and register
    await handleVerifyOtpAndRegister();
  };

  const strengthMeta = getStrengthMeta(passwordStrength);

  return (
    <AuthLayout activeTab="register">
      <form onSubmit={handleSubmit}>
        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!otpStep && (
          <>
            <div className="mb-6">
              <label className="flex items-center justify-center gap-3 cursor-pointer w-full">
                {preview ? (
                  <img
                    src={preview}
                    alt="Profile preview"
                    className="w-12 h-12 rounded-full object-cover border-2 border-blue-500"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 text-xs">
                    Photo
                  </div>
                )}

                <span className="text-sm text-gray-400">
                  {imageLoading
                    ? "Uploading picture..."
                    : "Upload profile picture (optional)"}
                </span>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>

            <InputFields
              icon={<User size={18} />}
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Full name"
            />

            <InputFields
              icon={<Mail size={18} />}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
            />

            {/* Password with show/hide toggle */}
            <div className="relative">
              <InputFields
                icon={<Lock size={18} />}
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {formData.password && (
              <div className="mt-3 mb-4 space-y-3">
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

                <ul className="space-y-1.5">
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(formData.password);
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

            {/* Confirm Password with show/hide toggle */}
            <div className="relative">
              <InputFields
                icon={<Lock size={18} />}
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
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
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </>
        )}

        {otpStep && (
          <div className="mb-4">
            <p className="text-sm text-gray-300 mb-3">
              OTP sent to{" "}
              <span className="text-blue-400">
                {pendingEmail}
              </span>
            </p>

            <InputFields
              icon={<Mail size={18} />}
              type="text"
              name="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
            />

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || resendLoading}
              className="w-full mt-3 py-2 rounded-lg font-semibold text-white transition-all text-sm"
              style={{
                background:
                  resendCooldown > 0 || resendLoading
                    ? "rgba(100, 116, 139, 0.5)"
                    : "linear-gradient(to right, #2563eb, #9333ea)",
                cursor:
                  resendCooldown > 0 || resendLoading
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {resendLoading
                ? "Sending OTP..."
                : resendCooldown > 0
                ? `Resend OTP in ${resendCooldown}s`
                : "Resend OTP"}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={
            imageLoading ||
            (!otpStep && passwordStrength !== "Strong")
          }
          className="w-full py-3 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "linear-gradient(to right, #2563eb, #9333ea)",
          }}
        >
          {otpStep ? "Verify OTP & Create Account" : "Create Account"}
        </button>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-blue-400 hover:underline">
            Login
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}