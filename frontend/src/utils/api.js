import { useDispatch } from "react-redux";
import { startApiLoading, stopApiLoading } from "../redux/apiLoadingSlice";

export const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3002"}/api`;

// Calls our API with the login token. Throws an Error with the server's message.
export async function api(path, token, method = "GET", body) {
  const res = await fetch(API_BASE_URL + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || "Something went wrong");
  return data;
}

// Runs a task while the global loader (apiLoadingSlice) is on.
export function useLoading() {
  const dispatch = useDispatch();
  return async (key, task) => {
    dispatch(startApiLoading(key));
    try {
      return await task();
    } finally {
      dispatch(stopApiLoading(key));
    }
  };
}