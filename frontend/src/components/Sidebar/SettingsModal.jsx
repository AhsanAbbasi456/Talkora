import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  User, UserPlus, Users, Lock, Palette, X, Search, Camera, Eye, EyeOff,
  Upload, Trash2, Pencil, Check, Sun, Moon, Monitor, LogOut,
} from "lucide-react";
import Avatar from "../../utils/Avatar";
import { api, useLoading } from "../../utils/api";
import useUserSearch from "../../utils/useUserSearch";
import { logoutUser, updateUser } from "../../redux/authSlice";
const DEFAULT_ABOUT = "Hey there! I am using Talkora.";
const field =
  "w-full rounded-lg border border-(--border) bg-(--input-bg) py-2.5 text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent)";

/* ---------------- SMALL SHARED PIECES ---------------- */

const Heading = ({ title, sub }) => (
  <>
    <h3 className="text-lg font-semibold text-(--text-primary)">{title}</h3>
    {sub && <p className="mb-5 text-sm text-(--text-muted)">{sub}</p>}
  </>
);

const Msg = ({ type, text }) => (
  <p className={`text-sm mt-3 ${type === "error" ? "text-red-400" : "text-green-400"}`}>{text}</p>
);

const SearchInput = ({ value, onChange, ...props }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${field} pl-9 pr-3`}
      {...props}
    />
  </div>
);

// Search results list (used by Add Contact and New Group)
function UserList({ query, loading, results, empty, onPick, action, maxH }) {
  const note = "py-3 text-center text-xs text-(--text-muted)";

  return (
    <div className={`mt-3 overflow-y-auto ${maxH}`}>
      {loading && <p className={note}>Searching...</p>}
      {!loading && query.trim().length >= 3 && !results.length && <p className={note}>{empty}</p>}

      {!loading &&
        results.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onPick(u)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-(--input-bg)"
          >
            <Avatar p={u} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-(--text-primary)">{u.name}</span>
              <span className="block truncate text-xs text-(--text-secondary)">{u.email}</span>
            </span>
            {action}
          </button>
        ))}
    </div>
  );
}

function Confirm({ icon: Icon, title, text, action, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[320px] bg-(--panel-bg) border border-(--border) rounded-2xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <Icon size={22} className="text-red-400" />
        </div>
        <h4 className="text-base font-semibold text-(--text-primary)">{title}</h4>
        <p className="text-sm text-(--text-muted) mt-1.5">{text}</p>

        <div className="flex gap-2.5 mt-5">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-[10px] text-sm text-(--text-primary) border border-(--border) hover:bg-(--input-bg) transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-[10px] text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition"
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}

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

    if (trimmed === (value || "")) return setEditing(false);
    if (trimmed.length < minLength) {
      return setError(`Please enter at least ${minLength} character${minLength > 1 ? "s" : ""}.`);
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
            <span className="text-xs text-(--text-muted) shrink-0">{maxLength - draft.length}</span>
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
          {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-base text-(--text-primary) break-words min-w-0">{value}</p>
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
  const withLoading = useLoading();
  const { user, token } = useSelector((state) => state.auth);

  const [photoBusy, setPhotoBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [overlay, setOverlay] = useState(null); // null | "menu" | "view" | "confirm"
  const fileInputRef = useRef(null);

  const hasPhoto = !!user?.avatarUrl;

  // tell the Settings window that a popup is open (so Esc closes only the popup)
  useEffect(() => {
    overlayRef.current = !!overlay;
    if (!overlay) return;

    const onKey = (e) => e.key === "Escape" && setOverlay(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, overlayRef]);

  useEffect(() => () => { overlayRef.current = false; }, [overlayRef]);

  const saveProfile = async (body) => {
    const data = await withLoading("updateProfile", () => api("/profile", token, "PUT", body));
    dispatch(updateUser(data.user));
    return data.user;
  };

  const runPhoto = async (busy, done, task) => {
    setPhotoBusy(busy);
    setMessage(null);

    try {
      await task();
      setMessage({ type: "success", text: done });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setPhotoBusy("");
    }
  };

  const handleAvatarClick = () => {
    if (photoBusy) return;
    if (hasPhoto) setOverlay((v) => (v === "menu" ? null : "menu"));
    else fileInputRef.current?.click();
  };

  const handlePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setOverlay(null);
    runPhoto("Uploading...", "Profile photo updated.", () =>
      withLoading("uploadAvatar", async () => saveProfile({ avatarUrl: await uploadImage(file, token) }))
    );
  };

  const handleRemove = () => {
    setOverlay(null);
    runPhoto("Removing...", "Profile photo removed.", () => saveProfile({ avatarUrl: null }));
  };

  const menu = [
    [Eye, "View photo", "view", "text-(--text-primary)"],
    [Upload, "Upload photo", "upload", "text-(--text-primary)"],
    [Trash2, "Remove photo", "confirm", "text-red-400"],
  ];

  return (
    <div>
      <Heading title="Profile" />

      {/* Profile photo */}
      <div className="relative w-40 mt-6">
        <button
          type="button"
          onClick={handleAvatarClick}
          title="Profile photo"
          className="group relative w-40 h-40 rounded-full overflow-hidden block focus:outline-none focus:ring-2 focus:ring-(--accent)"
        >
          <Avatar p={user} size="w-40 h-40" text="text-6xl" />

          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white ${
              photoBusy
                ? "bg-black/60 text-xs font-medium"
                : "bg-black/50 opacity-0 group-hover:opacity-100 transition"
            }`}
          >
            {photoBusy || (
              <>
                <Camera size={24} />
                <span className="text-[11px] font-medium tracking-wide text-center leading-tight px-9">
                  CHANGE PROFILE PHOTO
                </span>
              </>
            )}
          </div>
        </button>

        {overlay === "menu" && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOverlay(null)} />
            <div className="absolute left-0 top-full mt-2 w-52 z-20 bg-(--panel-bg) border border-(--border) rounded-xl shadow-2xl py-1.5 overflow-hidden">
              {menu.map(([Icon, label, action, color]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (action === "upload") {
                      setOverlay(null);
                      fileInputRef.current?.click();
                    } else {
                      setOverlay(action);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-(--input-bg) text-left ${color}`}
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
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

      {message && <Msg {...message} />}

      <EditableField
        label="Name"
        value={user?.name || ""}
        maxLength={50}
        minLength={2}
        onSave={(v) => saveProfile({ name: v })}
      />

      <EditableField
        label="About"
        value={user?.about || DEFAULT_ABOUT}
        maxLength={139}
        onSave={(v) => saveProfile({ about: v })}
      />

      <div className="mt-8">
        <p className="text-sm text-(--text-muted) mb-2">Email</p>
        <p className="text-base text-(--text-secondary) break-words">{user?.email || "No email"}</p>
      </div>

      {/* Big photo window */}
      {overlay === "view" && hasPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={() => setOverlay(null)}>
          <div className="flex items-center justify-between px-5 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 min-w-0">
              <Avatar p={user} />
              <p className="font-medium truncate">{user?.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setOverlay(null)}
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

      {overlay === "confirm" && (
        <Confirm
          icon={Trash2}
          title="Remove profile photo?"
          text="Your contacts will see your initial instead of your photo."
          action="Remove"
          onConfirm={handleRemove}
          onCancel={() => setOverlay(null)}
        />
      )}
    </div>
  );
}

/* ---------------- ADD CONTACT TAB ---------------- */
function AddContactTab({ onContactAdded }) {
  const { token } = useSelector((state) => state.auth);
  const withLoading = useLoading();
  const [query, setQuery] = useState("");
  const { results, loading } = useUserSearch(query, token);

  const add = async (u) => {
    try {
      const data = await withLoading("addContact", () => api("/conversations", token, "POST", { userId: u.id }));
      onContactAdded({ ...u, conversationId: data.conversationId });
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  return (
    <div>
      <Heading title="Add Contact" sub="Find someone by exact email or name to start a chat." />

      <SearchInput autoFocus value={query} onChange={setQuery} placeholder="Search by exact email or name" />

      <UserList
        query={query}
        loading={loading}
        results={results}
        empty="No user found with that email or name."
        onPick={add}
        maxH="max-h-[60vh]"
        action={
          <span className="px-3 py-1.5 rounded-lg bg-(--accent) text-[#F8FAFC] text-sm font-medium shrink-0">
            Add &amp; Chat
          </span>
        }
      />
    </div>
  );
}

/* ---------------- NEW GROUP TAB ---------------- */
function CreateGroupTab({ onGroupCreated }) {
  const { token } = useSelector((state) => state.auth);
  const withLoading = useLoading();

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const { results, loading } = useUserSearch(query, token, members.map((m) => m.id));

  const addMember = (member) => {
    setMembers((cur) => [...cur, member]);
    setQuery("");
    setError("");
  };

  const create = async (e) => {
    e.preventDefault();
    const groupName = name.trim();

    if (groupName.length < 2 || groupName.length > 100) {
      return setError("Group name must be between 2 and 100 characters.");
    }
    if (!members.length) return setError("Choose at least one person to add to the group.");

    setCreating(true);
    setError("");

    try {
      const data = await withLoading("createGroup", () =>
        api("/conversations/group", token, "POST", { name: groupName, memberIds: members.map((m) => m.id) })
      );
      onGroupCreated(data.group);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const label = "mb-2 block text-sm font-medium text-(--text-primary)";

  return (
    <form onSubmit={create}>
      <Heading title="New Group" sub="Choose people, then give your group a name." />

      <label className={label}>Group name</label>
      <input
        type="text"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        placeholder="For example, Talkora Friends"
        className={`${field} px-3 mb-5`}
      />

      <label className={label}>Add members</label>
      <SearchInput value={query} onChange={setQuery} placeholder="Search by exact name or email" />

      {members.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-(--border) bg-(--input-bg) py-1 pl-2.5 pr-1 text-xs text-(--text-primary)"
            >
              {member.name}
              <button
                type="button"
                onClick={() => setMembers((cur) => cur.filter((m) => m.id !== member.id))}
                aria-label={`Remove ${member.name}`}
                className="rounded-full p-1 text-(--text-muted) hover:bg-(--border) hover:text-(--text-primary)"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <UserList
        query={query}
        loading={loading}
        results={results}
        empty="No matching people found."
        onPick={addMember}
        maxH="max-h-[32vh]"
        action={<UserPlus size={18} className="shrink-0 text-(--accent)" />}
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={creating || !members.length}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-(--accent) px-4 py-2.5 text-sm font-medium text-[#F8FAFC] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Users size={17} />
        {creating ? "Creating group..." : "Create group"}
      </button>
    </form>
  );
}

/* ---------------- PASSWORD TAB ---------------- */

// Same rules as the register page
const PASSWORD_RULES = [
  ["At least 8 characters", (p) => p.length >= 8],
  ["One uppercase letter (A-Z)", (p) => /[A-Z]/.test(p)],
  ["One lowercase letter (a-z)", (p) => /[a-z]/.test(p)],
  ["One number (0-9)", (p) => /[0-9]/.test(p)],
  ["One special character (!@#$...)", (p) => /[^A-Za-z0-9]/.test(p)],
];

function PasswordField({ label, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);

  return (
    <div className="mt-5">
      <label className="block text-sm text-(--accent) mb-2">{label}</label>

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={72}
          className={`${field} pl-3 pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          title={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted) hover:text-(--text-primary) transition"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function PasswordTab() {
  const { token } = useSelector((state) => state.auth);
  const withLoading = useLoading();

  const [f, setF] = useState({ old: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const set = (key) => (value) => setF((cur) => ({ ...cur, [key]: value }));

  const passed = PASSWORD_RULES.filter(([, test]) => test(f.next)).length;
  const [strength, color] =
    passed <= 2 ? ["Weak", "bg-red-500"] : passed <= 4 ? ["Medium", "bg-yellow-500"] : ["Strong", "bg-green-500"];

  const matches = f.next === f.confirm;
  const sameAsOld = f.next.length > 0 && f.next === f.old;
  const canSubmit =
    f.old && passed === PASSWORD_RULES.length && f.confirm && matches && !sameAsOld;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    setMessage(null);

    try {
      await withLoading("updatePassword", () =>
        api("/profile/password", token, "PUT", { oldPassword: f.old, newPassword: f.next })
      );
      setF({ old: "", next: "", confirm: "" });
      setMessage({ type: "success", text: "Password updated successfully." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md">
      <Heading title="Password" sub="Change the password you use to log in." />

      <PasswordField label="Old password" value={f.old} onChange={set("old")} autoComplete="current-password" placeholder="Enter your old password" />
      <PasswordField label="New password" value={f.next} onChange={set("next")} autoComplete="new-password" placeholder="Enter a new password" />

      {f.next.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-(--border) overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${color}`}
                style={{ width: `${(passed / PASSWORD_RULES.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-(--text-secondary) w-14 text-right">{strength}</span>
          </div>

          <ul className="mt-3 space-y-1.5">
            {PASSWORD_RULES.map(([label, test]) => {
              const ok = test(f.next);
              return (
                <li key={label} className={`flex items-center gap-2 text-xs ${ok ? "text-green-400" : "text-(--text-muted)"}`}>
                  {ok ? <Check size={14} /> : <X size={14} />}
                  {label}
                </li>
              );
            })}
          </ul>

          {sameAsOld && (
            <p className="text-xs text-red-400 mt-2">New password must be different from your old password.</p>
          )}
        </div>
      )}

      <PasswordField label="Confirm password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" placeholder="Enter the new password again" />

      {f.confirm.length > 0 && (
        <p className={`text-xs mt-2 ${matches ? "text-green-400" : "text-red-400"}`}>
          {matches ? "Passwords match." : "Passwords do not match."}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || saving}
        className="mt-6 px-5 py-2.5 rounded-lg bg-(--accent) text-[#F8FAFC] text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Updating..." : "Update password"}
      </button>

      {message && <Msg {...message} />}
    </form>
  );
}

/* ---------------- APPEARANCE TAB ---------------- */
const THEMES = [
  ["system", "System", Monitor],
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
];

function AppearanceTab({ themeMode, onThemeChange }) {
  return (
    <div>
      <Heading title="Appearance" sub="Choose how Talkora looks on this device." />

      <div className="max-w-md flex items-center justify-between px-4 py-4 bg-(--input-bg) border border-(--border) rounded-xl">
        <p className="text-sm font-medium text-(--text-primary)">Theme</p>

        <div role="radiogroup" aria-label="Theme" className="flex items-center gap-1 bg-(--panel-bg) border border-(--border) rounded-lg p-1">
          {THEMES.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={themeMode === id}
              onClick={() => onThemeChange(id)}
              title={label}
              className={`p-2 rounded-md transition ${
                themeMode === id
                  ? "bg-(--accent)/15 text-(--accent)"
                  : "text-(--text-muted) hover:text-(--text-primary) hover:bg-(--input-bg)"
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- SETTINGS WINDOW (FULL SCREEN) ---------------- */
export default function SettingsModal({ open, onClose, onContactAdded, onGroupCreated, themeMode, onThemeChange }) {
  const [tab, setTab] = useState("profile");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const overlayRef = useRef(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (logoutOpen) return setLogoutOpen(false);
      if (!overlayRef.current) onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, logoutOpen]);

  if (!open) return null;

  const tabs = [
    ["profile", "Profile", User, <ProfileTab overlayRef={overlayRef} />],
    ["contact", "Add Contact", UserPlus, <AddContactTab onContactAdded={onContactAdded} />],
    ["group", "New Group", Users, <CreateGroupTab onGroupCreated={onGroupCreated} />],
    ["password", "Password", Lock, <PasswordTab />],
    ["appearance", "Appearance", Palette, <AppearanceTab themeMode={themeMode} onThemeChange={onThemeChange} />],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-(--panel-bg)">
      <div className="relative flex flex-col sm:flex-row w-full h-full">
        {/* Left menu */}
        <nav className="sm:w-64 shrink-0 p-3 sm:p-6 border-b sm:border-b-0 sm:border-r border-(--border) flex sm:flex-col gap-1">
          <h2 className="hidden sm:block px-2 mb-4 text-lg font-semibold text-(--text-primary)">Settings</h2>

          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition sm:mb-1 ${
                tab === id ? "bg-(--accent)/15 text-(--accent)" : "text-(--text-secondary) hover:bg-(--input-bg)"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}

          <div className="ml-auto shrink-0 sm:ml-0 sm:mt-auto sm:w-full sm:pt-3 sm:border-t border-(--border)">
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-sm font-medium text-red-400 bg-red-500/5 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-300 transition-colors"
            >
              <LogOut size={18} className="transition-transform group-hover:translate-x-0.5" />
              Log out
            </button>
          </div>
        </nav>

        {/* Right content */}
        <div className="flex-1 min-w-0 p-5 sm:p-10 overflow-y-auto">
          <div className="max-w-2xl">{tabs.find(([id]) => id === tab)[3]}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:bg-(--border) hover:text-(--text-primary) transition"
        >
          <X size={22} />
        </button>

        {logoutOpen && (
          <Confirm
            icon={LogOut}
            title="Log out of your account?"
            text="You can sign in again anytime to continue using Talkora."
            action="Log out"
            onCancel={() => setLogoutOpen(false)}
            onConfirm={() => {
              setLogoutOpen(false);
              dispatch(logoutUser());
              navigate("/login");
            }}
          />
        )}
      </div>
    </div>
  );
}