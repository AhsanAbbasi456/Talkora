import { useSelector } from "react-redux";

export default function Loader() {
  const isInitialLoading = useSelector(
    (state) => state.apiLoading.initialLoad
  );

  if (!isInitialLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-10 h-10 border-4 border-(--border) border-t-(--accent) rounded-full animate-spin" />
    </div>
  );
}