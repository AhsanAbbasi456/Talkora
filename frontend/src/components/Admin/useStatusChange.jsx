import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import StatusDialog from "./StatusDialog";
import { adminApi } from "./adminUtils";

// Opens the confirm dialog for approve / reject / suspend / ban and sends it.
// Usage: const { ask, approveNow, dialog } = useStatusChange(); ... {dialog}
export default function useStatusChange({ onDone } = {}) {
  const { token, refresh } = useOutletContext();
  const [pending, setPending] = useState(null); // { status, users }

  const send = async (users, change) => {
    if (users.length === 1) {
      await adminApi(`/users/${users[0].id}/status`, token, "POST", change);
    } else {
      const { skipped } = await adminApi("/users/bulk-status", token, "POST", {
        ids: users.map((u) => u.id),
        ...change,
      });
      if (skipped.length) {
        throw new Error(`${skipped.length} skipped: ${skipped.map((s) => `${s.name} (${s.error})`).join(", ")}`);
      }
    }
    refresh();
    onDone?.();
  };

  const ask = (status, users) => setPending({ status, users });

  // approving needs no reason, so it can skip the dialog
  const approveNow = (users) => send(users, { status: "APPROVED" });

  const dialog = pending && (
    <StatusDialog
      status={pending.status}
      names={pending.users.map((u) => u.name)}
      onConfirm={(change) => send(pending.users, change)}
      onClose={() => setPending(null)}
    />
  );

  return { ask, approveNow, dialog };
}
