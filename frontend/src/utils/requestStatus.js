import { API_BASE_URL } from "./api";

// The "tracking pass" for a sign-up request. It can only check the request
// status (never log in), so keeping it in localStorage is fine.
const KEY = "talkoraRequestToken";

export const saveStatusToken = (token) => {
  try {
    if (token) localStorage.setItem(KEY, token);
  } catch {
    // storage blocked: tracking just won't survive a reload
  }
};

export const getStatusToken = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const clearStatusToken = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
};

// Throws an Error with .status (401 = the pass expired)
export async function fetchRequestStatus(token) {
  const res = await fetch(`${API_BASE_URL}/auth/request-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || "Could not load status"), { status: res.status });
  return data;
}
