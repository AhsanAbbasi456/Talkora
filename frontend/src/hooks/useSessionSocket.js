import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import socket from "../socket";
import { logoutUser, updateUser } from "../redux/authSlice";

// Connects the socket with the login token and reacts to admin actions:
// suspended/banned -> status page, forced logout -> login page,
// role changed -> update the stored user (shows or hides the Admin button).
export default function useSessionSocket(token) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      socket.disconnect();
      return;
    }

    if (socket.connected) socket.disconnect();

    const blocked = (account) => {
      dispatch(logoutUser());
      navigate("/account-status", { replace: true, state: account });
    };

    const expired = (data) => {
      dispatch(logoutUser());
      navigate("/login", {
        replace: true,
        state: { notice: data?.message || "Your session ended. Please log in again." },
      });
    };

    const onConnectError = (error) => {
      if (error.message === "ACCOUNT_BLOCKED") return blocked(error.data);
      if (error.message === "SESSION_EXPIRED") return expired();
      console.error("Socket connection error:", error.message);
    };

    const onRoleChanged = ({ role }) => dispatch(updateUser({ role }));

    socket.auth = { token };
    socket.on("connect_error", onConnectError);
    socket.on("accountStatus", blocked);
    socket.on("sessionExpired", expired);
    socket.on("roleChanged", onRoleChanged);
    socket.connect();

    return () => {
      socket.off("connect_error", onConnectError);
      socket.off("accountStatus", blocked);
      socket.off("sessionExpired", expired);
      socket.off("roleChanged", onRoleChanged);
      if (socket.connected) socket.disconnect();
    };
  }, [token, dispatch, navigate]);
}
