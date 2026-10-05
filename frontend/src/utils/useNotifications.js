import { useEffect } from "react";
import { useDispatch } from "react-redux";
import socket from "../socket"; // ADJUST if socket.js uses a named export: { socket }
import {
  setPending,
  messageArrived,
  addNotification,
} from "../redux/notificationSlice";

export default function useNotifications(activeUserId) {
  const dispatch = useDispatch();

  useEffect(() => {
    const onPending = (data) => {
      dispatch(setPending(data));
      const total =
        data.messages.reduce((sum, m) => sum + m.count, 0) +
        data.others.length;
      if (total > 0) {
        console.log(`You have ${total} new notification${total > 1 ? "s" : ""}`);
      }
    };

    const onMessage = (n) => {
      if (n.senderId === activeUserId && document.hasFocus()) {
        socket.emit("markRead", { senderId: n.senderId });
        return;
      }
      dispatch(messageArrived(n));
    };

    const onNew = (n) => dispatch(addNotification(n));

    socket.on("notifications:pending", onPending);
    socket.on("notification:message", onMessage);
    socket.on("notification:new", onNew);

    // Ask for missed notifications after listeners are attached,
    // on first load and again on every reconnect.
    const requestPending = () => socket.emit("notifications:request");
    if (socket.connected) requestPending();
    socket.on("connect", requestPending);

    return () => {
      socket.off("notifications:pending", onPending);
      socket.off("notification:message", onMessage);
      socket.off("notification:new", onNew);
      socket.off("connect", requestPending);
    };
  }, [activeUserId, dispatch]);
}