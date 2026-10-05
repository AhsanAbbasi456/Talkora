import {
  Send,
  Paperclip,
  Smile,
  Phone,
  Video,
  MessageCircle,
  Info,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from "lucide-react";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  Fragment,
} from "react";

import { useSelector } from "react-redux";
import { isSameDay } from "date-fns";

import socket from "../../socket";

import ChatBubble from "../ChatBubble/ChatBubble";
import EmojiPicker from "../EmojiPicker/EmojiPicker";
import AttachmentMenu from "../AttachmentMenu/AttachmentMenu";

import { getAvatarColor } from "../../utils/avatarColor";
import { formatLastSeen } from "../../utils/formatLastSeen";
import { formatDateLabel } from "../../utils/formatDateLabel";

import DeleteMessageDialog from "../DeleteMessageDialog/DeleteMessageDialog";

export default function ChatWindow({
  activeChat,
  onSend,
  onShowDetails,
  onBack,
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState(null);

  // ==========================================
  // UNDO DELETE
  // ==========================================

  const [undoMessage, setUndoMessage] =
    useState(null);

  const [undoing, setUndoing] =
    useState(false);

  const [replyingTo, setReplyingTo] =
    useState(null);

  const [editingMessageId, setEditingMessageId] =
    useState(null);

  const [showEmojiPicker, setShowEmojiPicker] =
    useState(false);

  const [showAttachMenu, setShowAttachMenu] =
    useState(false);

  // ==========================================
  // SEARCH
  // ==========================================

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [activeMatch, setActiveMatch] =
    useState(0);

  const searchInputRef =
    useRef(null);

  // ==========================================
  // SCROLL
  // ==========================================

  const [showScrollButton, setShowScrollButton] =
    useState(false);

  const [newMessageCount, setNewMessageCount] =
    useState(0);

  // ==========================================
  // PRESENCE
  // ==========================================

  const [status, setStatus] = useState({
    isOnline: false,
    lastSeen: null,
  });

  const [, setTick] = useState(0);

  // ==========================================
  // TYPING
  // ==========================================

  const [isOtherTyping, setIsOtherTyping] =
    useState(false);

  const typingTimeoutRef =
    useRef(null);

  const isTypingRef =
    useRef(false);

  // ==========================================
  // REFS
  // ==========================================

  const pickerRef =
    useRef(null);

  const emojiButtonRef =
    useRef(null);

  const attachRef =
    useRef(null);

  const attachButtonRef =
    useRef(null);

  const textareaRef =
    useRef(null);

  const messagesContainerRef =
    useRef(null);

  const messagesRef =
    useRef([]);

  // ==========================================
  // UNDO TIMER REF
  // ==========================================

  const undoTimerRef =
    useRef(null);

  const { user } =
    useSelector((state) => state.auth);

  // ==========================================
  // KEEP MESSAGES REF UPDATED
  // ==========================================

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ==========================================
  // UNDO TIMER
  // ==========================================

  useEffect(() => {
    if (!undoMessage) {
      return;
    }

    clearTimeout(
      undoTimerRef.current,
    );

    undoTimerRef.current = setTimeout(() => {
      setUndoMessage(null);
      setUndoing(false);

      undoTimerRef.current = null;
    }, 5000);

    return () => {
      clearTimeout(
        undoTimerRef.current,
      );
    };
  }, [undoMessage]);

  // ==========================================
  // READ RECEIPTS
  // ==========================================

  const markAsRead = () => {
    if (
      !activeChat?.id ||
      !socket.connected ||
      document.hidden
    ) {
      return;
    }

    const hasUnread =
      messagesRef.current.some(
        (m) =>
          Number(m.senderId) ===
            Number(activeChat.id) &&
          !m.readAt &&
          !m.deletedForEveryone,
      );

    if (!hasUnread) {
      return;
    }

    socket.emit("markRead", {
      senderId: activeChat.id,
    });

    const now =
      new Date().toISOString();

    setMessages((prev) =>
      prev.map((m) =>
        Number(m.senderId) ===
          Number(activeChat.id) &&
        !m.readAt
          ? {
              ...m,
              readAt: now,
            }
          : m,
      ),
    );
  };

  // ==========================================
  // MARK AS READ WHEN MESSAGES CHANGE
  // ==========================================

  useEffect(() => {
    markAsRead();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeChat?.id]);

  // ==========================================
  // MARK AS READ WHEN TAB BECOMES VISIBLE
  // ==========================================

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) {
        markAsRead();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisible,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        onVisible,
      );
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // ==========================================
  // SEARCH LOGIC
  // ==========================================

  const matchIds = useMemo(() => {
    const q =
      searchQuery
        .trim()
        .toLowerCase();

    if (!q) {
      return [];
    }

    return messages
      .filter(
        (m) =>
          !m.deletedForEveryone &&
          !m.deletedForMeLocally &&
          m.body
            ?.toLowerCase()
            .includes(q),
      )
      .map((m) => m.id);
  }, [
    messages,
    searchQuery,
  ]);

  const safeMatchIndex =
    matchIds.length
      ? Math.min(
          activeMatch,
          matchIds.length - 1,
        )
      : 0;

  const activeMatchId =
    matchIds[safeMatchIndex];

  useEffect(() => {
    if (!activeMatchId) {
      return;
    }

    document
      .getElementById(
        `msg-${activeMatchId}`,
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [activeMatchId]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveMatch(0);
  }, [activeChat?.id]);

  const openSearch = () => {
    setSearchOpen(true);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveMatch(0);
  };

  const goToMatch = (direction) => {
    if (!matchIds.length) {
      return;
    }

    setActiveMatch(
      (safeMatchIndex +
        direction +
        matchIds.length) %
        matchIds.length,
    );
  };

  const handleSearchChange = (e) => {
    setSearchQuery(
      e.target.value,
    );

    setActiveMatch(
      Number.MAX_SAFE_INTEGER,
    );
  };

  // ==========================================
  // SCROLL HELPERS
  // ==========================================

  const isNearBottom = () => {
    const container =
      messagesContainerRef.current;

    if (!container) {
      return true;
    }

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    return distanceFromBottom < 100;
  };

  const scrollToBottom = (
    behavior = "smooth",
  ) => {
    const container =
      messagesContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  const handleScroll = () => {
    if (isNearBottom()) {
      setShowScrollButton(false);
      setNewMessageCount(0);
    } else {
      setShowScrollButton(true);
    }
  };

  const handleScrollButtonClick = () => {
    scrollToBottom("smooth");

    setNewMessageCount(0);
    setShowScrollButton(false);
  };

  // ==========================================
  // PRESENCE
  // ==========================================

  useEffect(() => {
    if (!activeChat?.id) {
      return;
    }

    setStatus({
      isOnline: false,
      lastSeen: null,
    });

    const askPresence = () => {
      socket.emit("getPresence", {
        userId: activeChat.id,
      });
    };

    if (socket.connected) {
      askPresence();
    }

    socket.on(
      "connect",
      askPresence,
    );

    return () => {
      socket.off(
        "connect",
        askPresence,
      );
    };
  }, [activeChat?.id]);

  useEffect(() => {
    if (!activeChat?.id) {
      return;
    }

    const onPresence = (data) => {
      if (
        Number(data.userId) !==
        Number(activeChat.id)
      ) {
        return;
      }

      setStatus((prev) => ({
        isOnline: data.isOnline,
        lastSeen:
          data.lastSeen ??
          prev.lastSeen,
      }));
    };

    socket.on(
      "presence",
      onPresence,
    );

    return () => {
      socket.off(
        "presence",
        onPresence,
      );
    };
  }, [activeChat?.id]);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);

    return () => {
      clearInterval(id);
    };
  }, []);

  // ==========================================
  // TYPING
  // ==========================================

  useEffect(() => {
    setIsOtherTyping(false);

    if (!activeChat?.id) {
      return;
    }

    let hideTimer;

    const onTyping = (data) => {
      if (
        Number(data.userId) !==
        Number(activeChat.id)
      ) {
        return;
      }

      setIsOtherTyping(
        data.isTyping,
      );

      clearTimeout(hideTimer);

      if (data.isTyping) {
        hideTimer = setTimeout(() => {
          setIsOtherTyping(false);
        }, 5000);
      }
    };

    socket.on(
      "typing",
      onTyping,
    );

    return () => {
      socket.off(
        "typing",
        onTyping,
      );

      clearTimeout(hideTimer);
    };
  }, [activeChat?.id]);

  useEffect(() => {
    const chatId =
      activeChat?.id;

    return () => {
      clearTimeout(
        typingTimeoutRef.current,
      );

      if (
        isTypingRef.current &&
        chatId
      ) {
        socket.emit("typing", {
          receiverId: chatId,
          isTyping: false,
        });
      }

      isTypingRef.current = false;
    };
  }, [activeChat?.id]);

  // ==========================================
  // TEXTAREA AUTO GROW
  // ==========================================

  useEffect(() => {
    const el =
      textareaRef.current;

    if (!el) {
      return;
    }

    el.style.height = "auto";

    el.style.height =
      Math.min(
        el.scrollHeight,
        128,
      ) + "px";
  }, [input]);

  // ==========================================
  // GET EXISTING MESSAGES
  // ==========================================

  useEffect(() => {
    setNewMessageCount(0);
    setShowScrollButton(false);
    setDeleteTarget(null);

    setUndoMessage(null);
    setUndoing(false);

    clearTimeout(
      undoTimerRef.current,
    );

    if (!activeChat?.id) {
      setMessages([]);
      return;
    }

    if (!socket.connected) {
      console.error(
        "Socket is not connected",
      );

      return;
    }

    const handleMessages = (data) => {
      console.log(
        "Messages received:",
        data,
      );

      setMessages(
        data.messages || [],
      );

      setTimeout(() => {
        scrollToBottom("auto");
      }, 0);
    };

    const handleMessageError = (
      data,
    ) => {
      console.error(
        "Message error:",
        data?.error,
      );

      setUndoing(false);
    };

    socket.on(
      "messages",
      handleMessages,
    );

    socket.on(
      "messageError",
      handleMessageError,
    );

    socket.emit("getMessages", {
      userId: activeChat.id,
    });

    return () => {
      socket.off(
        "messages",
        handleMessages,
      );

      socket.off(
        "messageError",
        handleMessageError,
      );
    };
  }, [activeChat?.id]);

  // ==========================================
  // SOCKET MESSAGE HANDLERS
  // ==========================================

  useEffect(() => {
    if (
      !activeChat?.id ||
      !user?.id
    ) {
      return;
    }

    // ========================================
    // OWN MESSAGE SENT
    // ========================================

    const handleMessageSent = (
      message,
    ) => {
      const isCurrentChat =
        Number(message.senderId) ===
          Number(user.id) &&
        Number(message.receiverId) ===
          Number(activeChat.id);

      if (!isCurrentChat) {
        return;
      }

      setMessages(
        (prevMessages) => {
          const alreadyExists =
            prevMessages.some(
              (existingMessage) =>
                Number(
                  existingMessage.id,
                ) ===
                Number(message.id),
            );

          if (alreadyExists) {
            return prevMessages;
          }

          return [
            ...prevMessages,
            message,
          ];
        },
      );

      setTimeout(() => {
        scrollToBottom("smooth");
      }, 0);

      setNewMessageCount(0);
      setShowScrollButton(false);
    };

    // ========================================
    // NEW MESSAGE
    // ========================================

    const handleNewMessage = (
      message,
    ) => {
      const isCurrentChat =
        Number(message.senderId) ===
          Number(activeChat.id) &&
        Number(message.receiverId) ===
          Number(user.id);

      if (!isCurrentChat) {
        return;
      }

      const alreadyExists =
        messagesRef.current.some(
          (existingMessage) =>
            Number(
              existingMessage.id,
            ) ===
            Number(message.id),
        );

      if (alreadyExists) {
        return;
      }

      setIsOtherTyping(false);

      const shouldScroll =
        isNearBottom();

      setMessages(
        (prevMessages) => {
          const exists =
            prevMessages.some(
              (existingMessage) =>
                Number(
                  existingMessage.id,
                ) ===
                Number(message.id),
            );

          if (exists) {
            return prevMessages;
          }

          return [
            ...prevMessages,
            message,
          ];
        },
      );

      if (shouldScroll) {
        setTimeout(() => {
          scrollToBottom("smooth");
        }, 0);
      } else {
        setNewMessageCount(
          (count) => count + 1,
        );

        setShowScrollButton(true);
      }
    };

    // ========================================
    // MESSAGE DELETED
    // ========================================

    const handleMessageDeleted = (
      data,
    ) => {
      const {
        messageId,
        mode,
      } = data;

      const targetMessage =
        messagesRef.current.find(
          (message) =>
            Number(message.id) ===
            Number(messageId),
        );

      if (!targetMessage) {
        return;
      }

      // ======================================
      // DELETE FOR ME
      // ======================================

      if (mode === "me") {
        setMessages((prev) =>
          prev.map((message) =>
            Number(message.id) ===
            Number(messageId)
              ? {
                  ...message,
                  deletedForMeLocally: true,
                }
              : message,
          ),
        );

        setUndoMessage({
          ...targetMessage,
          undoMode: "me",
        });

        setUndoing(false);

        return;
      }

      // ======================================
      // DELETE FOR EVERYONE
      // ======================================

      const canUndoEveryone =
        Number(
          targetMessage.senderId,
        ) === Number(user.id);

      setMessages((prev) =>
        prev.map((message) =>
          Number(message.id) ===
          Number(messageId)
            ? {
                ...message,
                deletedForEveryone: true,
                body: "",
              }
            : message,
        ),
      );

      // Only the sender gets the Undo option
      if (canUndoEveryone) {
        setUndoMessage({
          ...targetMessage,
          undoMode: "everyone",
        });

        setUndoing(false);
      }
    };

    // ========================================
    // MESSAGE RESTORED
    // ========================================

    const handleMessageRestored = (
      message,
    ) => {
      const messageId =
        Number(
          message.messageId ??
            message.id,
        );

      setMessages((prev) => {
        const exists =
          prev.some(
            (existingMessage) =>
              Number(
                existingMessage.id,
              ) === messageId,
          );

        if (exists) {
          return prev.map(
            (existingMessage) =>
              Number(
                existingMessage.id,
              ) === messageId
                ? {
                    ...existingMessage,
                    ...message,
                    id: messageId,
                    body:
                      message.body,
                    deletedForEveryone:
                      false,
                    deletedForMeLocally:
                      false,
                  }
                : existingMessage,
          );
        }

        return [
          ...prev,
          {
            ...message,
            id: messageId,
            deletedForEveryone:
              false,
            deletedForMeLocally:
              false,
          },
        ];
      });

      setUndoMessage(null);
      setUndoing(false);

      clearTimeout(
        undoTimerRef.current,
      );
    };

    // ========================================
    // MESSAGE EDITED
    // ========================================

    const handleMessageEdited = ({
      messageId,
      body,
      editedAt,
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.id) ===
          Number(messageId)
            ? {
                ...m,
                body,
                editedAt,
              }
            : m,
        ),
      );
    };

    // ========================================
    // OTHER USER READ OUR MESSAGES
    // ========================================

    const handleMessagesRead = ({
      readerId,
      readAt,
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.senderId) ===
            Number(user.id) &&
          Number(m.receiverId) ===
            Number(readerId) &&
          !m.readAt
            ? {
                ...m,
                readAt,
              }
            : m,
        ),
      );
    };

    socket.on(
      "messageSent",
      handleMessageSent,
    );

    socket.on(
      "newMessage",
      handleNewMessage,
    );

    socket.on(
      "messageDeleted",
      handleMessageDeleted,
    );

    socket.on(
      "messageRestored",
      handleMessageRestored,
    );

    socket.on(
      "messageEdited",
      handleMessageEdited,
    );

    socket.on(
      "messagesRead",
      handleMessagesRead,
    );

    return () => {
      socket.off(
        "messageSent",
        handleMessageSent,
      );

      socket.off(
        "newMessage",
        handleNewMessage,
      );

      socket.off(
        "messageDeleted",
        handleMessageDeleted,
      );

      socket.off(
        "messageRestored",
        handleMessageRestored,
      );

      socket.off(
        "messageEdited",
        handleMessageEdited,
      );

      socket.off(
        "messagesRead",
        handleMessagesRead,
      );
    };
  }, [
    activeChat?.id,
    user?.id,
  ]);

  // ==========================================
  // DELETE MESSAGE
  // ==========================================

  const handleDeleteConfirm = (
    mode,
  ) => {
    if (!deleteTarget) {
      return;
    }

    socket.emit(
      "deleteMessage",
      {
        messageId:
          deleteTarget.id,
        mode,
      },
    );

    setDeleteTarget(null);
  };

  // ==========================================
  // UNDO DELETE MESSAGE
  // ==========================================

  const handleUndoDelete = (
    message,
  ) => {
    if (
      !message ||
      undoing
    ) {
      return;
    }

    // Only allow undo for the
    // currently active undo message.

    if (
      !undoMessage ||
      Number(undoMessage.id) !==
        Number(message.id)
    ) {
      return;
    }

    setUndoing(true);

    socket.emit(
      "undoDeleteMessage",
      {
        messageId: message.id,
        mode:
          undoMessage.undoMode,
      },
    );
  };

  // ==========================================
  // REPLY
  // ==========================================

  const handleReply = (
    message,
  ) => {
    setReplyingTo(message);
    setEditingMessageId(null);

    setInput((prev) =>
      prev && !prev.trim()
        ? ""
        : prev,
    );
  };

  // ==========================================
  // EDIT
  // ==========================================

  const handleEdit = (
    message,
  ) => {
    setEditingMessageId(
      message.id,
    );

    setReplyingTo(null);

    setInput(
      message.body || "",
    );
  };

  // ==========================================
  // TYPING
  // ==========================================

  const stopTyping = () => {
    clearTimeout(
      typingTimeoutRef.current,
    );

    if (
      isTypingRef.current &&
      activeChat?.id
    ) {
      socket.emit(
        "typing",
        {
          receiverId:
            activeChat.id,
          isTyping: false,
        },
      );
    }

    isTypingRef.current = false;
  };

  const handleInputChange = (
    e,
  ) => {
    setInput(e.target.value);

    if (!activeChat?.id) {
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;

      socket.emit(
        "typing",
        {
          receiverId:
            activeChat.id,
          isTyping: true,
        },
      );
    }

    clearTimeout(
      typingTimeoutRef.current,
    );

    typingTimeoutRef.current =
      setTimeout(
        stopTyping,
        2000,
      );
  };

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  const handleSend = (e) => {
    e.preventDefault();

    const text =
      input.trim();

    if (
      !text ||
      sending
    ) {
      return;
    }

    if (!socket.connected) {
      console.error(
        "Socket is not connected",
      );

      return;
    }

    try {
      setSending(true);

      // ======================================
      // EDIT
      // ======================================

      if (editingMessageId) {
        socket.emit(
          "editMessage",
          {
            messageId:
              editingMessageId,
            body: text,
          },
        );

        setEditingMessageId(
          null,
        );
      }

      // ======================================
      // REPLY
      // ======================================

      else if (replyingTo) {
        socket.emit(
          "replyMessage",
          {
            receiverId:
              activeChat.id,
            body: text,
            replyToId:
              replyingTo.id,
          },
        );

        setReplyingTo(null);
      }

      // ======================================
      // NORMAL MESSAGE
      // ======================================

      else {
        onSend(text);
      }

      setInput("");

      stopTyping();

      setShowEmojiPicker(
        false,
      );
    } catch (error) {
      console.error(
        "Send message error:",
        error,
      );
    } finally {
      setSending(false);
    }
  };

  // ==========================================
  // ATTACHMENTS
  // ==========================================

  const handleAttachFiles = (
    type,
    files,
  ) => {
    console.log(
      "Selected via",
      type,
      files,
    );

    setShowAttachMenu(false);
  };

  const handleAttachAction = (
    actionId,
  ) => {
    console.log(
      "Attachment action:",
      actionId,
    );

    setShowAttachMenu(false);
  };

  // ==========================================
  // CLOSE PICKERS
  // ==========================================

  useEffect(() => {
    if (
      !showEmojiPicker &&
      !showAttachMenu
    ) {
      return;
    }

    const handleClickOutside = (
      e,
    ) => {
      if (
        showEmojiPicker &&
        pickerRef.current &&
        !pickerRef.current.contains(
          e.target,
        ) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(
          e.target,
        )
      ) {
        setShowEmojiPicker(
          false,
        );
      }

      if (
        showAttachMenu &&
        attachRef.current &&
        !attachRef.current.contains(
          e.target,
        ) &&
        attachButtonRef.current &&
        !attachButtonRef.current.contains(
          e.target,
        )
      ) {
        setShowAttachMenu(
          false,
        );
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, [
    showEmojiPicker,
    showAttachMenu,
  ]);

  // ==========================================
  // NO ACTIVE CHAT
  // ==========================================

  if (!activeChat) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-(--app-bg) min-w-0 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-(--panel-bg) border border-(--border) flex items-center justify-center mb-4">
          <MessageCircle
            className="text-(--accent)"
            size={28}
          />
        </div>

        <h2 className="text-(--text-primary) font-semibold text-lg">
          Welcome to Talkora
        </h2>

        <p className="text-(--text-muted) text-sm mt-1">
          Choose a chat to start a
          conversation
        </p>
      </div>
    );
  }

  const userInitials =
    activeChat.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    "U";

  return (
    <div className="flex-1 flex flex-col bg-(--app-bg) min-w-0">
      {/* ========================================
          CHAT HEADER
      ======================================== */}

      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-(--border) bg-(--panel-bg)">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden rounded-lg p-1 -ml-1 text-gray-400 hover:text-white transition shrink-0"
            title="Back to chats"
          >
            <ArrowLeft size={20} />
          </button>

          {activeChat.avatarUrl ? (
            <img
              src={
                activeChat.avatarUrl
              }
              alt={
                activeChat.name
              }
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-(--border)"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm shrink-0"
              style={{
                backgroundColor:
                  getAvatarColor(
                    activeChat.id,
                  ),
              }}
            >
              {userInitials}
            </div>
          )}

          <div className="min-w-0">
            <p className="text-(--text-primary) font-medium text-sm truncate">
              {activeChat.name}
            </p>

            <p
              className={`flex items-center gap-1.5 text-xs truncate ${
                isOtherTyping ||
                status.isOnline
                  ? "text-(--accent)"
                  : "text-(--text-muted)"
              }`}
            >
              {!isOtherTyping &&
                status.isOnline && (
                  <span className="w-1.5 h-1.5 rounded-full bg-(--accent) shrink-0" />
                )}

              <span className="truncate">
                {isOtherTyping
                  ? "typing..."
                  : status.isOnline
                    ? "Online"
                    : formatLastSeen(
                        status.lastSeen,
                      )}
              </span>
            </p>
          </div>
        </div>

        {/* HEADER BUTTONS */}

        <div className="flex items-center gap-3 sm:gap-4 text-gray-400 shrink-0">
          <div className="relative group hidden sm:block">
            <button
              type="button"
              aria-label="Audio call"
              className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition"
              title="Coming soon"
            >
              <Phone size={18} />
            </button>

            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 z-20">
              Coming soon
            </span>
          </div>

          <div className="relative group hidden sm:block">
            <button
              type="button"
              aria-label="Video call"
              className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition"
              title="Coming soon"
            >
              <Video size={18} />
            </button>

            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 z-20">
              Coming soon
            </span>
          </div>

          <button
            type="button"
            onClick={
              searchOpen
                ? closeSearch
                : openSearch
            }
            className={`rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition ${
              searchOpen
                ? "text-(--accent)"
                : ""
            }`}
            title="Search in chat"
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            onClick={
              onShowDetails
            }
            className="rounded-lg p-1 hover:bg-[#334155] hover:text-white transition"
            title="View chat details"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* ========================================
          SEARCH BAR
      ======================================== */}

      {searchOpen && (
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2 border-b border-(--border) bg-(--panel-bg)">
          <Search
            size={16}
            className="text-(--text-muted) shrink-0"
          />

          <input
            ref={
              searchInputRef
            }
            value={
              searchQuery
            }
            onChange={
              handleSearchChange
            }
            onKeyDown={(e) => {
              if (
                e.key ===
                "Enter"
              ) {
                e.preventDefault();

                goToMatch(
                  e.shiftKey
                    ? 1
                    : -1,
                );
              }

              if (
                e.key ===
                "Escape"
              ) {
                closeSearch();
              }
            }}
            placeholder="Search in this chat..."
            className="flex-1 min-w-0 bg-transparent text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none"
          />

          {searchQuery.trim() && (
            <span className="text-xs text-(--text-muted) shrink-0">
              {matchIds.length
                ? `${
                    safeMatchIndex +
                    1
                  } of ${
                    matchIds.length
                  }`
                : "No results"}
            </span>
          )}

          <button
            type="button"
            onClick={() =>
              goToMatch(-1)
            }
            disabled={
              !matchIds.length
            }
            className="p-1 text-gray-400 hover:text-white disabled:opacity-40"
            title="Older match"
          >
            <ChevronUp
              size={18}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              goToMatch(1)
            }
            disabled={
              !matchIds.length
            }
            className="p-1 text-gray-400 hover:text-white disabled:opacity-40"
            title="Newer match"
          >
            <ChevronDown
              size={18}
            />
          </button>

          <button
            type="button"
            onClick={
              closeSearch
            }
            className="p-1 text-gray-400 hover:text-white"
            title="Close search"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* ========================================
          MESSAGES
      ======================================== */}

      <div className="relative flex-1 min-h-0">
        <div
          ref={
            messagesContainerRef
          }
          onScroll={
            handleScroll
          }
          className="custom-scrollbar h-full overflow-y-auto px-3 sm:px-5 py-4"
        >
          {messages.length > 0 ? (
            messages.map(
              (
                message,
                index,
              ) => {
                const isOwn =
                  Number(
                    message.senderId,
                  ) ===
                  Number(
                    user?.id,
                  );

                const previous =
                  messages[
                    index - 1
                  ];

                const showDate =
                  !previous ||
                  !isSameDay(
                    new Date(
                      previous.createdAt,
                    ),
                    new Date(
                      message.createdAt,
                    ),
                  );

                const deliveryState =
                  isOwn
                    ? message.readAt
                      ? "read"
                      : status.isOnline
                        ? "delivered"
                        : "sent"
                    : "none";

                // ==================================
                // CAN THIS MESSAGE BE UNDONE?
                // ==================================

                const canUndo =
                  Boolean(
                    undoMessage &&
                      Number(
                        undoMessage.id,
                      ) ===
                        Number(
                          message.id,
                        ),
                  );

                return (
                  <Fragment
                    key={
                      message.id
                    }
                  >
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] text-(--text-muted) bg-(--panel-bg) border border-(--border) px-3 py-1 rounded-full">
                          {formatDateLabel(
                            message.createdAt,
                          )}
                        </span>
                      </div>
                    )}

                    <div
                      id={`msg-${message.id}`}
                    >
                      <ChatBubble
                        message={
                          message
                        }
                        isOwn={
                          isOwn
                        }
                        avatarColor={getAvatarColor(
                          activeChat.id,
                        )}
                        name={
                          activeChat.name
                        }
                        menuUp={
                          index >=
                          messages.length -
                            2
                        }
                        onDelete={() =>
                          setDeleteTarget(
                            message,
                          )
                        }
                        onReply={() =>
                          handleReply(
                            message,
                          )
                        }
                        onEdit={() =>
                          handleEdit(
                            message,
                          )
                        }
                        onUndo={() =>
                          handleUndoDelete(
                            message,
                          )
                        }
                        canUndo={
                          canUndo
                        }
                        searchQuery={
                          searchQuery
                        }
                        isActiveMatch={
                          message.id ===
                          activeMatchId
                        }
                        deliveryState={
                          deliveryState
                        }
                      />
                    </div>
                  </Fragment>
                );
              },
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-(--panel-bg) border border-(--border) flex items-center justify-center mb-3">
                <MessageCircle
                  className="text-(--accent)"
                  size={24}
                />
              </div>

              <p className="text-(--text-primary) text-sm font-medium">
                No messages yet
              </p>

              <p className="text-(--text-muted) text-xs mt-1">
                Start a conversation
                with{" "}
                {
                  activeChat.name
                }
              </p>
            </div>
          )}
        </div>

        {/* SCROLL BUTTON */}

        {showScrollButton && (
          <button
            type="button"
            onClick={
              handleScrollButtonClick
            }
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
            className="absolute bottom-4 right-4 sm:right-6 w-10 h-10 rounded-full bg-(--panel-bg) border border-(--border) text-(--text-primary) shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition z-10"
          >
            <ChevronDown
              size={20}
            />

            {newMessageCount >
              0 && (
              <span className="absolute -top-2 -right-1 min-w-5 h-5 px-1 rounded-full bg-(--accent) text-[#F8FAFC] text-[11px] font-semibold flex items-center justify-center">
                {newMessageCount >
                99
                  ? "99+"
                  : newMessageCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ========================================
          REPLY / EDIT BAR
      ======================================== */}

      {(replyingTo ||
        editingMessageId) && (
        <div className="flex items-center justify-between gap-3 border-t border-(--border) bg-(--panel-bg) px-3 sm:px-5 pt-2 pb-1">
          <div className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--input-bg) px-3 py-2 text-xs text-(--text-muted)">
            <div className="font-medium uppercase tracking-[0.08em] text-(--text-muted)">
              {editingMessageId
                ? "Editing message"
                : "Replying to"}
            </div>

            <div className="mt-0.5 truncate text-(--text-primary)">
              {editingMessageId
                ? messages.find(
                    (m) =>
                      Number(
                        m.id,
                      ) ===
                      Number(
                        editingMessageId,
                      ),
                  )?.body ||
                  "Message"
                : replyingTo?.body ||
                  "Message"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setReplyingTo(
                null,
              );

              setEditingMessageId(
                null,
              );

              setInput("");
            }}
            className="rounded-lg p-1.5 text-(--text-muted) hover:bg-white/5 hover:text-(--text-primary)"
            aria-label="Cancel reply or edit"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================
          MESSAGE INPUT
      ======================================== */}

      <form
        onSubmit={
          handleSend
        }
        className="relative flex items-end gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-t border-(--border) bg-(--panel-bg)"
      >
        {/* ATTACHMENT BUTTON */}

        <button
          ref={
            attachButtonRef
          }
          type="button"
          onClick={() =>
            setShowAttachMenu(
              (value) =>
                !value,
            )
          }
          className={`hidden sm:flex items-center justify-center mb-2.5 text-gray-400 hover:text-white transition shrink-0 ${
            showAttachMenu
              ? "text-(--accent)"
              : ""
          }`}
          title="Attach"
        >
          <Paperclip
            size={20}
          />
        </button>

        {showAttachMenu && (
          <div
            ref={
              attachRef
            }
            className="absolute bottom-full left-3 mb-2 z-30"
          >
            <AttachmentMenu
              onSelectFiles={
                handleAttachFiles
              }
              onAction={
                handleAttachAction
              }
            />
          </div>
        )}

        {/* EMOJI BUTTON */}

        <button
          ref={
            emojiButtonRef
          }
          type="button"
          onClick={() =>
            setShowEmojiPicker(
              (value) =>
                !value,
            )
          }
          className={`hidden sm:flex items-center justify-center mb-2.5 text-gray-400 hover:text-white transition shrink-0 ${
            showEmojiPicker
              ? "text-(--accent)"
              : ""
          }`}
          title="Insert emoji"
        >
          <Smile size={20} />
        </button>

        {showEmojiPicker && (
          <div
            ref={
              pickerRef
            }
            className="absolute bottom-full left-3 sm:left-16 mb-2 z-30"
          >
            <EmojiPicker
              onSelect={(emoji) =>
                setInput(
                  (prev) =>
                    prev + emoji,
                )
              }
            />
          </div>
        )}

        {/* TEXTAREA */}

        <textarea
          ref={
            textareaRef
          }
          rows={1}
          value={input}
          onChange={
            handleInputChange
          }
          onKeyDown={(e) => {
            if (
              e.key ===
                "Enter" &&
              !e.shiftKey
            ) {
              e.preventDefault();

              handleSend(e);
            }
          }}
          placeholder={`Message ${activeChat.name}...`}
          disabled={sending}
          className="flex-1 resize-none max-h-32 px-4 py-2.5 bg-(--input-bg) border border-(--border) rounded-3xl text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent disabled:opacity-60"
        />

        {/* SEND BUTTON */}

        <button
          type="submit"
          disabled={
            sending ||
            !input.trim()
          }
          className="w-10 h-10 rounded-full flex items-center justify-center bg-(--accent) text-[#F8FAFC] shrink-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          <Send size={16} />
        </button>
      </form>

      {/* ========================================
          DELETE CONFIRMATION
      ======================================== */}

      <DeleteMessageDialog
        message={
          deleteTarget
        }
        isOwn={
          deleteTarget
            ? Number(
                deleteTarget.senderId,
              ) ===
              Number(user?.id)
            : false
        }
        onDelete={
          handleDeleteConfirm
        }
        onCancel={() =>
          setDeleteTarget(
            null,
          )
        }
      />
    </div>
  );
}