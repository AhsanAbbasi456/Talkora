import { Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

import Register from "./components/Register/register";
import Login from "./components/Login/login";
import Home from "./components/Home/home";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />

      {/* Public Route */}
      <Route path="/register" element={<Register />} />

      {/* Protected Route */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Unknown URL */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;