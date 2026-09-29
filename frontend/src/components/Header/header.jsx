import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../../redux/authSlice";

export default function Header() {
  const { isAuthenticated } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  return (
    <header className="w-full bg-white shadow-sm px-6 py-4 flex justify-between items-center">
      <Link to="/" className="text-xl font-bold text-gray-800">
        Talkora
      </Link>
      <nav className="flex gap-4 items-center">
        {isAuthenticated ? (
          <button
            onClick={() => dispatch(logoutUser())}
            className="text-red-600 font-medium"
          >
            Logout
          </button>
        ) : (
          <>
            <Link to="/login" className="text-gray-700">Login</Link>
            <Link to="/register" className="text-gray-700">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}