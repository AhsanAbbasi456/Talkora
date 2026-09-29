import { Link } from "react-router-dom";
import backgroundImage from "../../assets/images/background.png";

export default function AuthLayout({ activeTab, children }) {
  return (
    <div
      className="relative min-h-screen w-full flex bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(15,10,31,0) 0%, rgba(15,10,31,0.02) 45%, rgba(15,10,31,0.35) 74%, rgba(15,10,31,0.72) 100%), url(${backgroundImage})`,
      }}
    >
      <div className="absolute inset-0 bg-[#07111f]/35 lg:hidden" />

      {/* Right side - Form card */}
      <div className="relative z-10 flex w-full lg:w-1/2 lg:ml-auto items-center justify-center lg:justify-end p-3 sm:p-6 bg-transparent min-h-screen lg:min-h-0">
        <div className="w-full max-w-lg bg-[#11142d]/65 backdrop-blur-xl border border-white/15 rounded-2xl p-4 sm:p-7 shadow-2xl">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-2xl font-bold text-white">
              {activeTab === "login" ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {activeTab === "login"
                ? "Sign in to continue to Talkora"
                : "Join Talkora and start chatting"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 mb-4 sm:mb-6">
            <Link
              to="/login"
              className={`flex-1 text-center pb-3 font-medium text-sm transition ${
                activeTab === "login"
                  ? "text-blue-400 border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Login
            </Link>
            <Link
              to="/register"
              className={`flex-1 text-center pb-3 font-medium text-sm transition ${
                activeTab === "register"
                  ? "text-blue-400 border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Register
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}