import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowLeft } from "lucide-react";
import logo from "../../assets/images/logo.png";

const prefersLight = () => !window.matchMedia("(prefers-color-scheme: dark)").matches;

// Frame for the Plus / billing pages, in the user's light or dark theme
export default function PlusShell({ children, back = { to: "/home", label: "Back to chats" } }) {
  const themeMode = useSelector((state) => state.auth.user?.themeMode) || "system";
  const isLight = themeMode === "system" ? prefersLight() : themeMode === "light";

  return (
    <div className={`min-h-dvh bg-(--app-bg) text-(--text-primary) ${isLight ? "theme-light" : ""}`}>
      <header className="border-b border-(--border) bg-(--panel-bg)">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/home" className="flex items-center">
            <img src={logo} alt="Talkora" className="h-8 w-auto max-w-20 object-contain" />
          </Link>
          {back && (
            <Link
              to={back.to}
              className="flex items-center gap-1.5 text-sm text-(--text-muted) hover:text-(--text-primary)"
            >
              <ArrowLeft size={16} />
              {back.label}
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
