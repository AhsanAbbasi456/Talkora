import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Register from "./components/Register/register";
import Login from "./components/Login/login";
import ForgotPassword from "./components/ForgetPassword/ForgotPassword";
import VerifyResetOtp from "./components/VerifyResetOtp/VerifyResetOtp";
import ResetPassword from "./components/ResetPassword/ResetPassword";
import Home from "./components/Home/home";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import AccountStatus from "./components/AccountStatus/AccountStatus";

// Admin pages load only when an admin opens them
const AdminLayout = lazy(() => import("./components/Admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./components/Admin/AdminDashboard"));
const AdminRequests = lazy(() => import("./components/Admin/AdminRequests"));
const AdminUsers = lazy(() => import("./components/Admin/AdminUsers"));
const AdminUserDetail = lazy(() => import("./components/Admin/AdminUserDetail"));
const AdminAudit = lazy(() => import("./components/Admin/AdminAudit"));
const AdminCalls = lazy(() => import("./components/Admin/AdminCalls"));
const AdminGroups = lazy(() => import("./components/Admin/AdminGroups"));
const AdminPayments = lazy(() => import("./components/Admin/AdminPayments"));

// Talkora Plus pages
const UpgradePage = lazy(() => import("./components/Plus/UpgradePage"));
const BillingPage = lazy(() => import("./components/Plus/BillingPage"));
const PaymentResult = lazy(() => import("./components/Plus/PaymentResult"));
const TestCheckout = lazy(() => import("./components/Plus/TestCheckout"));
const ManualCheckout = lazy(() => import("./components/Plus/ManualCheckout"));

// login required + lazy-loaded page
const Protected = ({ children }) => (
  <ProtectedRoute>
    <Suspense fallback={null}>{children}</Suspense>
  </ProtectedRoute>
);

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
      <Route path="/account-status" element={<AccountStatus />} />

      {/* Protected Home page */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Talkora Plus */}
      <Route path="/upgrade" element={<Protected><UpgradePage /></Protected>} />
      <Route path="/billing" element={<Protected><BillingPage /></Protected>} />
      <Route path="/billing/result" element={<Protected><PaymentResult /></Protected>} />
      <Route path="/checkout/test/:orderId" element={<Protected><TestCheckout /></Protected>} />
      <Route path="/checkout/manual/:orderId" element={<Protected><ManualCheckout /></Protected>} />

      {/* Admin pages (the server checks the role on every request) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Suspense fallback={null}>
              <AdminLayout />
            </Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="calls" element={<AdminCalls />} />
        <Route path="groups" element={<AdminGroups />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="audit" element={<AdminAudit />} />
      </Route>

      {/* Any unknown URL → Login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;