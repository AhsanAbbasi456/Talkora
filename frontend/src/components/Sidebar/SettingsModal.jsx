import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  User,
  UserPlus,
  Lock,
  Palette,
  X,
  Search,
  Camera,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Pencil,
  Check,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { getAvatarColor } from "../../utils/avatarColor";
import { updateUser } from "../../redux/authSlice";
import {
  startApiLoading,
  stopApiLoading,
} from "../../redux/apiLoadingSlice";

const API_BASE_URL = "http://localhost:3000/api";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const DEFAULT_ABOUT = "Hey there! I am using Talkora.";

/* ---------------- EDITABLE FIELD (pencil -> input -> tick) ---------------- */
function EditableField({ label, value, maxLength, minLength = 1, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const start = () => {
    setDraft(value || "");
    setError("");
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError("");
  };

  const save = async () => {
    const trimmed = draft.trim();

    if (trimmed === (value || "")) {
      setEditing(false);
      return;
    }

    if (trimmed.length < minLength) {
      setError(
        `Please enter at least ${minLength} character${
          minLength > 1 ? "s" : ""
        }.`
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8">
      <p className="text-sm text-(--accent) mb-2">{label}</p>

      {editing ? (
        <div>
          <div className="flex items-center gap-3 border-b-2 border-(--accent) pb-1.5">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={maxLength}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }

                if (e.key === "Escape") {
                  e.stopPropagation();
                  cancel();
                }
              }}
              className="flex-1 min-w-0 bg-transparent text-base text-(--text-primary) focus:outline-none"
            />

            <span className="text-xs text-(--text-muted) shrink-0">
              {maxLength - draft.length}
            </span>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              title="Save"
              className="text-(--text-muted) hover:text-(--accent) transition shrink-0 disabled:opacity-50"
            >
              <Check size={20} />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 mt-1.5">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-base text-(--text-primary) break-words min-w-0">
            {value}
          </p>

          <button
            type="button"
            onClick={start}
            title={`Edit ${label.toLowerCase()}`}
            className="text-(--text-muted) hover:text-(--text-primary) transition shrink-0"
          >
            <Pencil size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- PROFILE TAB ---------------- */
function ProfileTab({ overlayRef }) {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);

  const [photoBusy, setPhotoBusy] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  const [menuOpen, setMenuOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fileInputRef = useRef(null);

  const hasPhoto = !!user?.avatarUrl;
  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";

  useEffect(() => {
    const anyOpen = menuOpen || viewOpen || confirmOpen;

    overlayRef.current = anyOpen;

    if (!anyOpen) return;

    const onKey = (e) => {
      if (e.key !== "Escape") return;

      if (confirmOpen) setConfirmOpen(false);
      else if (viewOpen) setViewOpen(false);
      else setMenuOpen(false);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, viewOpen, confirmOpen, overlayRef]);

  useEffect(() => {
    return () => {
      overlayRef.current = false;
    };
  }, [overlayRef]);

  // Send the profile update to our backend and update the app
  const saveProfile = async (body) => {
    dispatch(startApiLoading("updateProfile"));

    try {
      const res = await fetch(`${API_BASE_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || "Could not update profile"
        );
      }

      dispatch(updateUser(data.user));

      return data.user;
    } finally {
      dispatch(stopApiLoading("updateProfile"));
    }
  };

  const handleAvatarClick = () => {
    if (photoBusy) return;

    if (hasPhoto) {
      setMenuOpen((v) => !v);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handlePick = async (e) => {
    const picked = e.target.files?.[0];

    e.target.value = "";

    if (!picked) return;

    if (!ALLOWED_TYPES.includes(picked.type)) {
      setMessage({
        type: "error",
        text: "Please choose a JPG, PNG or WEBP image.",
      });
      return;
    }

    if (picked.size > MAX_SIZE) {
      setMessage({
        type: "error",
        text: "Image must be smaller than 2 MB.",
      });
      return;
    }

    setMenuOpen(false);
    setPhotoBusy("Uploading...");
    setMessage({ type: "", text: "" });

    dispatch(startApiLoading("uploadAvatar"));

    try {
      const sigRes = await fetch(
        `${API_BASE_URL}/cloudinary/signature`
      );

      if (!sigRes.ok) {
        throw new Error(
          "Could not start the photo upload"
        );
      }

      const sig = await sigRes.json();

      const uploadData = new FormData();

      uploadData.append("file", picked);
      uploadData.append("api_key", sig.apiKey);
      uploadData.append("timestamp", sig.timestamp);
      uploadData.append("signature", sig.signature);

      const upRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        {
          method: "POST",
          body: uploadData,
        }
      );

      const upJson = await upRes.json();

      if (!upRes.ok || !upJson.secure_url) {
        throw new Error(
          upJson?.error?.message ||
            "Photo upload failed"
        );
      }

      await saveProfile({
        avatarUrl: upJson.secure_url,
      });

      setMessage({
        type: "success",
        text: "Profile photo updated.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    } finally {
      dispatch(stopApiLoading("uploadAvatar"));
      setPhotoBusy("");
    }
  };

  const handleRemove = async () => {
    setConfirmOpen(false);
    setPhotoBusy("Removing...");
    setMessage({ type: "", text: "" });

    try {
      await saveProfile({
        avatarUrl: null,
      });

      setMessage({
        type: "success",
        text: "Profile photo removed.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    } finally {
      setPhotoBusy("");
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-(--text-primary) mb-6">
        Profile
      </h3>

      {/* ---------- Profile photo ---------- */}
      <div className="relative w-40">
        <button
          type="button"
          onClick={handleAvatarClick}
          title="Profile photo"
          className="group relative w-40 h-40 rounded-full overflow-hidden block focus:outline-none focus:ring-2 focus:ring-(--accent)"
        >
          {hasPhoto ? (
            <img
              src={user.avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[#F8FAFC] text-6xl font-semibold"
              style={{
                backgroundColor: getAvatarColor(user?.id),
              }}
            >
              {initial}
            </div>
          )}

          {!photoBusy && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 text-white">
              <Camera size={24} />

              <span className="text-[11px] font-medium tracking-wide text-center leading-tight px-9">
                CHANGE PROFILE PHOTO
              </span>
            </div>
          )}

          {photoBusy && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-medium">
              {photoBusy}
            </div>
          )}
        </button>

        {/* Small menu */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />

            <div className="absolute left-0 top-full mt-2 w-52 z-20 bg-(--panel-bg) border border-(--border) rounded-xl shadow-2xl py-1.5 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setViewOpen(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--text-primary) hover:bg-(--input-bg) text-left"
              >
                <Eye size={17} />
                View photo
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--text-primary) hover:bg-(--input-bg) text-left"
              >
                <Upload size={17} />
                Upload photo
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmOpen(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-(--input-bg) text-left"
              >
                <Trash2 size={17} />
                Remove photo
              </button>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePick}
          className="hidden"
        />
      </div>

      {message.text && (
        <p
          className={`text-sm mt-3 ${
            message.type === "error"
              ? "text-red-400"
              : "text-green-400"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* ---------- Name ---------- */}
      <EditableField
        label="Name"
        value={user?.name || ""}
        maxLength={50}
        minLength={2}
        onSave={(v) => saveProfile({ name: v })}
      />

      {/* ---------- About ---------- */}
      <EditableField
        label="About"
        value={user?.about || DEFAULT_ABOUT}
        maxLength={139}
        minLength={1}
        onSave={(v) => saveProfile({ about: v })}
      />

      {/* ---------- Email ---------- */}
      <div className="mt-8">
        <p className="text-sm text-(--text-muted) mb-2">
          Email
        </p>

        <p className="text-base text-(--text-secondary) break-words">
          {user?.email || "No email"}
        </p>
      </div>

      {/* ---------- Big photo window ---------- */}
      {viewOpen && hasPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex flex-col"
          onClick={() => setViewOpen(false)}
        >
          <div
            className="flex items-center justify-between px-5 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={user.avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />

              <p className="font-medium truncate">
                {user?.name}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setViewOpen(false)}
              title="Close (Esc)"
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            <img
              src={user.avatarUrl}
              alt="Profile"
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* ---------- Remove confirmation ---------- */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-(--panel-bg) border border-(--border) rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold text-(--text-primary)">
              Remove profile photo?
            </h4>

            <p className="text-sm text-(--text-muted) mt-2">
              Your contacts will see your initial instead of your photo.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-(--text-primary) hover:bg-(--input-bg) transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRemove}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:opacity-90 transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- ADD CONTACT TAB ---------------- */
function AddContactTab({ onContactAdded }) {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search users
  useEffect(() => {
    const q = query.trim();

    if (q.length < 3) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      dispatch(startApiLoading("searchUsers"));

      try {
        const res = await fetch(
          `${API_BASE_URL}/conversations/search?q=${encodeURIComponent(
            q
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setResults((await res.json()) || []);
      } catch (error) {
        console.error("User search failed:", error);
      } finally {
        setLoading(false);
        dispatch(stopApiLoading("searchUsers"));
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, token, dispatch]);

  // Start a chat with the chosen user
  const handleAdd = async (selectedUser) => {
    dispatch(startApiLoading("addContact"));

    try {
      const res = await fetch(
        `${API_BASE_URL}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: selectedUser.id,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to start conversation"
        );
      }

      const data = await res.json();

      onContactAdded({
        ...selectedUser,
        conversationId: data.conversationId,
      });
    } catch (error) {
      console.error(
        "Failed to start conversation:",
        error
      );
    } finally {
      dispatch(stopApiLoading("addContact"));
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-(--text-primary)">
        Add Contact
      </h3>

      <p className="text-sm text-(--text-muted) mb-4">
        Find someone by exact email or name to start a chat.
      </p>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          size={16}
        />

        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by exact email or name"
          className="w-full pl-9 pr-3 py-2.5 bg-(--input-bg) border border-(--border) rounded-lg text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      <div className="mt-3 max-h-[60vh] overflow-y-auto">
        {loading && (
          <p className="text-xs text-(--text-muted) text-center py-3">
            Searching...
          </p>
        )}

        {!loading &&
          query.trim().length >= 3 &&
          results.length === 0 && (
            <p className="text-xs text-(--text-muted) text-center py-3">
              No user found with that email or name.
            </p>
          )}

        {!loading &&
          results.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-(--input-bg)"
            >
              {u.avatarUrl ? (
                <img
                  src={u.avatarUrl}
                  alt={u.name}
                  className="w-10 h-10 rounded-full object-cover border border-(--border)"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm"
                  style={{
                    backgroundColor: getAvatarColor(u.id),
                  }}
                >
                  {u.name?.charAt(0)?.toUpperCase() ||
                    "U"}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-(--text-primary) truncate">
                  {u.name}
                </p>

                <p className="text-xs text-(--text-secondary) truncate">
                  {u.email}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAdd(u)}
                className="px-3 py-1.5 rounded-lg bg-(--accent) text-[#F8FAFC] text-sm font-medium hover:opacity-90 shrink-0"
              >
                Add &amp; Chat
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ---------------- PASSWORD TAB ---------------- */

// Same rules as the register page
const PASSWORD_RULES = [
  {
    id: "len",
    label: "At least 8 characters",
    test: (p) => p.length >= 8,
  },
  {
    id: "upper",
    label: "One uppercase letter (A-Z)",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "lower",
    label: "One lowercase letter (a-z)",
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: "num",
    label: "One number (0-9)",
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: "special",
    label: "One special character (!@#$...)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="mt-5">
      <label className="block text-sm text-(--accent) mb-2">
        {label}
      </label>

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={72}
          className="w-full pl-3 pr-11 py-2.5 bg-(--input-bg) border border-(--border) rounded-lg text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />

        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          title={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted) hover:text-(--text-primary) transition"
        >
          {show ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

function PasswordTab() {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const passed = PASSWORD_RULES.filter((r) =>
    r.test(newPassword)
  ).length;

  const isStrong =
    passed === PASSWORD_RULES.length;

  const strengthLabel =
    passed <= 2
      ? "Weak"
      : passed <= 4
      ? "Medium"
      : "Strong";

  const strengthColor =
    passed <= 2
      ? "bg-red-500"
      : passed <= 4
      ? "bg-yellow-500"
      : "bg-green-500";

  const matches =
    newPassword === confirmPassword;

  const sameAsOld =
    newPassword.length > 0 &&
    newPassword === oldPassword;

  const canSubmit =
    oldPassword.length > 0 &&
    isStrong &&
    confirmPassword.length > 0 &&
    matches &&
    !sameAsOld;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canSubmit || saving) return;

    setSaving(true);
    setMessage({ type: "", text: "" });

    dispatch(startApiLoading("updatePassword"));

    try {
      const res = await fetch(
        `${API_BASE_URL}/profile/password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            oldPassword,
            newPassword,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message ||
            "Could not update password"
        );
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setMessage({
        type: "success",
        text: "Password updated successfully.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    } finally {
      setSaving(false);
      dispatch(stopApiLoading("updatePassword"));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md"
    >
      <h3 className="text-lg font-semibold text-(--text-primary)">
        Password
      </h3>

      <p className="text-sm text-(--text-muted)">
        Change the password you use to log in.
      </p>

      <PasswordField
        label="Old password"
        value={oldPassword}
        onChange={setOldPassword}
        autoComplete="current-password"
        placeholder="Enter your old password"
      />

      <PasswordField
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        placeholder="Enter a new password"
      />

      {/* Strength bar + checklist */}
      {newPassword.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-(--border) overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${strengthColor}`}
                style={{
                  width: `${
                    (passed / PASSWORD_RULES.length) *
                    100
                  }%`,
                }}
              />
            </div>

            <span className="text-xs text-(--text-secondary) w-14 text-right">
              {strengthLabel}
            </span>
          </div>

          <ul className="mt-3 space-y-1.5">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(newPassword);

              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-2 text-xs ${
                    ok
                      ? "text-green-400"
                      : "text-(--text-muted)"
                  }`}
                >
                  {ok ? (
                    <Check size={14} />
                  ) : (
                    <X size={14} />
                  )}

                  {rule.label}
                </li>
              );
            })}
          </ul>

          {sameAsOld && (
            <p className="text-xs text-red-400 mt-2">
              New password must be different from your old password.
            </p>
          )}
        </div>
      )}

      <PasswordField
        label="Confirm password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        placeholder="Enter the new password again"
      />

      {confirmPassword.length > 0 &&
        !matches && (
          <p className="text-xs text-red-400 mt-2">
            Passwords do not match.
          </p>
        )}

      {confirmPassword.length > 0 &&
        matches &&
        newPassword.length > 0 && (
          <p className="text-xs text-green-400 mt-2">
            Passwords match.
          </p>
        )}

      <button
        type="submit"
        disabled={!canSubmit || saving}
        className="mt-6 px-5 py-2.5 rounded-lg bg-(--accent) text-[#F8FAFC] text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving
          ? "Updating..."
          : "Update password"}
      </button>

      {message.text && (
        <p
          className={`text-sm mt-3 ${
            message.type === "error"
              ? "text-red-400"
              : "text-green-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

/* ---------------- APPEARANCE TAB ---------------- */
// themeMode: "system" | "light" | "dark"
// onThemeChange(mode): call to switch theme
function AppearanceTab({ themeMode, onThemeChange }) {
  const options = [
    { id: "system", label: "System", Icon: Monitor },
    { id: "light", label: "Light", Icon: Sun },
    { id: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-(--text-primary)">
        Appearance
      </h3>

      <p className="text-sm text-(--text-muted) mb-6">
        Choose how Talkora looks on this device.
      </p>

      <div className="max-w-md flex items-center justify-between px-4 py-4 bg-(--input-bg) border border-(--border) rounded-xl">
        <p className="text-sm font-medium text-(--text-primary)">
          Theme
        </p>

        {/* 3-way segmented toggle: System / Light / Dark */}
        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex items-center gap-1 bg-(--panel-bg) border border-(--border) rounded-lg p-1"
        >
          {options.map(({ id, label, Icon }) => {
            const active = themeMode === id;

            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onThemeChange(id)}
                title={label}
                className={`p-2 rounded-md transition ${
                  active
                    ? "bg-(--accent)/15 text-(--accent)"
                    : "text-(--text-muted) hover:text-(--text-primary) hover:bg-(--input-bg)"
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- SETTINGS WINDOW (FULL SCREEN) ---------------- */
export default function SettingsModal({
  open,
  onClose,
  onContactAdded,
  themeMode,      // "system" | "light" | "dark"
  onThemeChange,  // (mode) => void
}) {
  const [tab, setTab] = useState("profile");

  const overlayRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (
        e.key !== "Escape" ||
        overlayRef.current
      ) {
        return;
      }

      onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      Icon: User,
    },
    {
      id: "contact",
      label: "Add Contact",
      Icon: UserPlus,
    },
    {
      id: "password",
      label: "Password",
      Icon: Lock,
    },
    {
      id: "appearance",
      label: "Appearance",
      Icon: Palette,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-(--panel-bg)">
      <div className="relative flex flex-col sm:flex-row w-full h-full">

        {/* Left menu */}
        <nav className="sm:w-64 shrink-0 p-3 sm:p-6 border-b sm:border-b-0 sm:border-r border-(--border) flex sm:block gap-1">
          <h2 className="hidden sm:block px-2 mb-4 text-lg font-semibold text-(--text-primary)">
            Settings
          </h2>

          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition sm:mb-1 ${
                tab === id
                  ? "bg-(--accent)/15 text-(--accent)"
                  : "text-(--text-secondary) hover:bg-(--input-bg)"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="flex-1 min-w-0 p-5 sm:p-10 overflow-y-auto">
          <div className="max-w-2xl">
            {tab === "profile" && (
              <ProfileTab overlayRef={overlayRef} />
            )}

            {tab === "contact" && (
              <AddContactTab
                onContactAdded={onContactAdded}
              />
            )}

            {tab === "password" && (
              <PasswordTab />
            )}

            {tab === "appearance" && (
              <AppearanceTab
                themeMode={themeMode}
                onThemeChange={onThemeChange}
              />
            )}
          </div>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:bg-(--border) hover:text-(--text-primary) transition"
        >
          <X size={22} />
        </button>
      </div>
    </div>
  );
}