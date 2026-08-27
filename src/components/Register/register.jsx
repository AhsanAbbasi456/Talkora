import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { User, Mail, Lock } from "lucide-react";

import { registerUser } from "../../redux/authSlice";
import InputFields from "../InputFields/InputFields";
import AuthLayout from "../authlayout/authlayout";

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

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

  // ==========================================
  // HANDLE INPUT CHANGE
  // ==========================================

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setError("");
  };

  // ==========================================
  // HANDLE PROFILE PICTURE
  // ==========================================

  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    if (file.size > 7 * 1024 * 1024) {
      setError("Profile picture must be smaller than 7 MB");
      e.target.value = "";
      return;
    }

    // Show image preview
    const imageUrl = URL.createObjectURL(file);
    setPreview(imageUrl);
    setImageLoading(true);
    setError("");

    // Convert image to Base64
    const reader = new FileReader();

    reader.onloadend = () => {
      setFormData((prevData) => ({
        ...prevData,
        picture: reader.result,
      }));
      setImageLoading(false);
    };

    reader.onerror = () => {
      setImageLoading(false);
      setError("Unable to read the profile picture");
    };

    reader.readAsDataURL(file);
  };

  // ==========================================
  // HANDLE REGISTER
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    // Check passwords
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (imageLoading) {
      setError("Please wait for the profile picture to finish loading");
      return;
    }

    // Send registration data to backend
    const result = await dispatch(
      registerUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        picture: formData.picture,
      })
    );

    // Registration successful
    if (registerUser.fulfilled.match(result)) {
      navigate("/login");
    } else {
      setError(result.payload || "Registration failed");
    }
  };

  return (
    <AuthLayout activeTab="register">
      <form onSubmit={handleSubmit}>

        {/* Error message */}
        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Profile Picture */}
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
              Upload profile picture (optional)
            </span>

            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />

          </label>
        </div>

        {/* Name */}
        <InputFields
          icon={<User size={18} />}
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Full name"
        />

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

        {/* Confirm Password */}
        <InputFields
          icon={<Lock size={18} />}
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm password"
        />

        {/* Register Button */}
        <button
          type="submit"
          disabled={imageLoading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          style={{
            background:
              "linear-gradient(to right, #2563eb, #9333ea)",
          }}
        >
          Create Account
        </button>

        {/* Login Link */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-blue-400 hover:underline"
          >
            Login
          </a>
        </p>

      </form>
    </AuthLayout>
  );
}