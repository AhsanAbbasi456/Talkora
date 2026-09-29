import { Routes, Route, Navigate } from "react-router-dom";

import Register from "./components/Register/register";
import Login from "./components/Login/login";
import ForgotPassword from "./components/ForgetPassword/ForgotPassword";
import VerifyResetOtp from "./components/VerifyResetOtp/VerifyResetOtp";
import ResetPassword from "./components/ResetPassword/ResetPassword";
import Home from "./components/Home/home";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Root URL → Login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected Home page */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Any unknown URL → Login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;