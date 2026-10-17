import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { X, Pencil, Check, UserMinus, LogOut, Shield, ShieldOff, Camera, Trash2, Eye, Upload } from "lucide-react";
import { getAvatarColor } from "../../utils/avatarColor";
import { uploadImage } from "../../utils/imageUpload.js";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:3002"}/api/conversations`;
const box = "w-full px-3 py-2 rounded-lg bg-(--input-bg) border border-(--border) text-sm text-(--text-primary)";

const Avatar = ({ p, size = "w-10 h-10" }) =>
  p.avatarUrl ? (
    <img src={p.avatarUrl} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-full flex items-center justify-center font-semibold text-[#F8FAFC] shrink-0`}
      style={{ backgroundColor: getAvatarColor(p.id) }}>
      {p.name?.[0]?.toUpperCase()}
    </div>
  );

export default function GroupInfo({ chat, onClose, onUpdate }) {
  const { user, token } = useSelector((s) => s.auth);
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoViewing, setPhotoViewing] = useState(false);
  const [photoDeleteConfirm, setPhotoDeleteConfirm] = useState(false);
  const photoInputRef = useRef(null);

  const me = Number(user.id);
  const isAdmin = chat.members.some((m) => m.userId === me && m.role === "ADMIN");
  const url = `/group/${chat.conversationId}`;

  useEffect(() => {
    if (!photoViewing && !photoMenuOpen && !photoDeleteConfirm) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setPhotoViewing(false);
      setPhotoMenuOpen(false);
      setPhotoDeleteConfirm(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [photoViewing, photoMenuOpen, photoDeleteConfirm]);

  const call = async (path, method = "GET", body) => {
    const res = await fetch(API + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body && JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Something went wrong");
    if (data.conversationId) onUpdate(data);
    return data;
  };

  const updatePhoto = async (file) => {
    setPhotoBusy(true);
    setPhotoMenuOpen(false);
    setPhotoError("");
    try {
      const avatarUrl = await uploadImage(file, token);
      await call(url, "PATCH", { avatarUrl });
    } catch (error) {
      setPhotoError(error.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const updated = await call(url, "PATCH", { avatarUrl: null });
      if (!updated) throw new Error("Could not remove the group photo.");
      setPhotoDeleteConfirm(false);
    } catch (error) {
      setPhotoError(error.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const search = async (q) => {
    setQuery(q);
    const users = q.trim().length < 3 ? [] : (await call(`/search?q=${encodeURIComponent(q.trim())}`)) || [];
    setFound(users.filter((u) => !chat.members.some((m) => m.userId === u.id)));
  };

  return (
    <div className="fixed inset-0 z-40 sm:static sm:w-80 shrink-0 flex flex-col bg-(--panel-bg) border-l border-(--border) overflow-y-auto">
      <div className="flex justify-between px-4 py-3 border-b border-(--border) text-(--text-primary)">
        Group info
        <button onClick={onClose}><X size={18} /></button>
      </div>

      <div className="flex flex-col items-center gap-2 p-5 text-center">
        <div className="relative mb-1">
          <button
            type="button"
            onClick={() => {
              if (isAdmin) {
                setPhotoMenuOpen((open) => !open);
                setPhotoError("");
              } else if (chat.avatarUrl) {
                setPhotoViewing(true);
              }
            }}
            disabled={photoBusy}
            aria-label={isAdmin ? "Manage group photo" : "View group photo"}
            aria-expanded={isAdmin ? photoMenuOpen : undefined}
            className="group relative block h-24 w-24 overflow-hidden rounded-full border border-(--border) bg-(--input-bg) focus:outline-none focus:ring-2 focus:ring-(--accent) disabled:cursor-default"
          >
            <Avatar p={{ id: chat.conversationId, ...chat }} size="h-full w-full" />
            {isAdmin && (
              <span className={`absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-[9px] font-medium tracking-wide text-white transition-opacity ${photoMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
                <Camera size={19} />
                {photoMenuOpen ? "PHOTO OPTIONS" : "MANAGE GROUP PHOTO"}
              </span>
            )}
          </button>
          {isAdmin && (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) updatePhoto(file);
                }}
              />
              {photoMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close group photo options"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setPhotoMenuOpen(false)}
                  />
                  <div className="absolute left-1/2 top-full z-20 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-(--border) bg-(--panel-bg) py-1.5 text-left shadow-2xl">
                    {chat.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoMenuOpen(false);
                          setPhotoViewing(true);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-(--text-primary) transition hover:bg-(--input-bg)"
                      >
                        <Eye size={17} />
                        View photo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-(--text-primary) transition hover:bg-(--input-bg)"
                    >
                      <Upload size={17} />
                      {chat.avatarUrl ? "Change photo" : "Upload photo"}
                    </button>
                    {chat.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoMenuOpen(false);
                          setPhotoDeleteConfirm(true);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 transition hover:bg-(--input-bg)"
                      >
                        <Trash2 size={17} />
                        Delete photo
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        {photoBusy && <p className="text-xs text-(--text-muted)">Saving group photo...</p>}
        {photoError && <p role="alert" className="text-xs text-red-400">{photoError}</p>}
        {draft ? (
          <>
            <input className={box} value={draft.name} placeholder="Group name"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <textarea className={box} rows={3} value={draft.description} placeholder="Description"
              onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <button className="flex items-center gap-1 text-sm text-(--accent)"
              onClick={async () => (await call(url, "PATCH", draft)) && setDraft(null)}>
              <Check size={16} /> Save
            </button>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-lg font-semibold text-(--text-primary)">
              {chat.name}
              {isAdmin && (
                <button onClick={() => setDraft({ name: chat.name, description: chat.description || "" })}>
                  <Pencil size={14} />
                </button>
              )}
            </p>
            <p className="text-sm text-(--text-muted)">{chat.description || "No description"}</p>
          </>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="mb-2 text-xs uppercase text-(--text-muted)">{chat.members.length} members</p>

        {isAdmin && (
          <>
            <input className={`${box} mb-2`} value={query} placeholder="Add member by exact name or email"
              onChange={(e) => search(e.target.value)} />
            {found.map((u) => (
              <button key={u.id} className="flex w-full items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5"
                onClick={async () => (await call(`${url}/members`, "POST", { userIds: [u.id] })) && search("")}>
                <Avatar p={u} size="w-8 h-8" />
                <span className="text-sm text-(--text-primary)">{u.name}</span>
                <span className="ml-auto text-xs text-(--accent)">Add</span>
              </button>
            ))}
          </>
        )}

        {chat.members.map(({ userId, role, user: p }) => (
          <div key={userId} className="flex items-center gap-3 py-2">
            <Avatar p={p} />
            <p className="flex-1 truncate text-sm text-(--text-primary)">
              {p.name}{userId === me && " (You)"}
            </p>
            {role === "ADMIN" && <span className="text-[10px] text-(--accent)">Admin</span>}
            {isAdmin && userId !== me && userId !== chat.createdBy && (
              <>
                <button className="text-gray-400 hover:text-white" title={role === "ADMIN" ? "Remove admin" : "Make admin"}
                  onClick={() => call(`${url}/members/${userId}`, "PATCH", { role: role === "ADMIN" ? "MEMBER" : "ADMIN" })}>
                  {role === "ADMIN" ? <ShieldOff size={16} /> : <Shield size={16} />}
                </button>
                <button className="text-gray-400 hover:text-red-400" title="Remove"
                  onClick={() => call(`${url}/members/${userId}`, "DELETE")}>
                  <UserMinus size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <button className="mt-auto flex items-center gap-2 px-4 py-4 border-t border-(--border) text-sm text-red-400"
        onClick={() => window.confirm("Leave this group?") && call(`${url}/leave`, "POST")}>
        <LogOut size={16} /> Leave group
      </button>

      {photoViewing && chat.avatarUrl && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/90"
          onClick={() => setPhotoViewing(false)}
          role="presentation"
        >
          <div
            className="flex items-center justify-between px-5 py-3 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="truncate font-medium">{chat.name}</p>
            <button
              type="button"
              onClick={() => setPhotoViewing(false)}
              aria-label="Close group photo"
              className="rounded-full p-2 transition hover:bg-white/10"
            >
              <X size={22} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <img
              src={chat.avatarUrl}
              alt={`${chat.name} group photo`}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {photoDeleteConfirm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPhotoDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-[320px] rounded-2xl border border-(--border) bg-(--panel-bg) p-6 text-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <h4 className="text-base font-semibold text-(--text-primary)">Delete group photo?</h4>
            <p className="mt-1.5 text-sm text-(--text-muted)">
              Group members will see the default group image instead.
            </p>
            {photoError && <p role="alert" className="mt-3 text-sm text-red-400">{photoError}</p>}
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => setPhotoDeleteConfirm(false)}
                className="flex-1 rounded-[10px] border border-(--border) py-2.5 text-sm text-(--text-primary) transition hover:bg-(--input-bg) disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={photoBusy}
                onClick={removePhoto}
                className="flex-1 rounded-[10px] bg-red-500 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {photoBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}