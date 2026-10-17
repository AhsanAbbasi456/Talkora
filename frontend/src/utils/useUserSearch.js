import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { API_BASE_URL } from "./api";
import { startApiLoading, stopApiLoading } from "../redux/apiLoadingSlice";

// Finds users by exact name/email (3+ letters), 300ms after typing stops.
// `exclude` = user ids to hide from the results.
export default function useUserSearch(query, token, exclude = []) {
  const dispatch = useDispatch();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      dispatch(startApiLoading("searchUsers"));

      try {
        const res = await fetch(`${API_BASE_URL}/conversations/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        setResults(res.ok ? await res.json() : []);
      } catch (error) {
        if (error.name !== "AbortError") console.error("User search failed:", error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
        dispatch(stopApiLoading("searchUsers"));
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, token, dispatch]);

  return { results: results.filter((u) => !exclude.includes(u.id)), loading };
}