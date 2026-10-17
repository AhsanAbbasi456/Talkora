// utils/sanitizeMessage.js
function sanitizeMessage(message, currentUserId) {
  if (!message.viewOnce) return message;

  const viewedByMe = (message.views || []).some((v) => v.userId === currentUserId);
  const isSender = message.senderId === currentUserId;
  const viewedByRecipient = (message.views || []).some(
    (v) => v.userId !== message.senderId,
  );

  return {
    ...message,
    fileUrl: null, // NEVER expose the real link
    fileName: null,
    fileSize: null,
    viewOnce: true,
    viewOnceState: message.mediaExpired
      ? "EXPIRED"
      : isSender
      ? viewedByRecipient
        ? "OPENED"
        : "SENT"
      : viewedByMe
      ? "OPENED"
      : "UNOPENED",
    views: undefined,
  };
}

module.exports = sanitizeMessage;