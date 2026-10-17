import {
  Send,
  Mic,
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
  Bot,
  Sparkles,
  Copy,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo, Fragment } from "react";
import { useSelector } from "react-redux";
import { isSameDay } from "date-fns";
import socket from "../../socket";
import { listen } from "../../utils/socketListen";
import useCall from "../../hooks/useCall";
import CallOverlay from "../CallOverlay/CallOverlay";
import ChatBubble from "../ChatBubble/ChatBubble";
import EmojiPicker from "../EmojiPicker/EmojiPicker";
import AttachmentMenu from "../AttachmentMenu/AttachmentMenu";
import CameraModal from "../CameraModal/CameraModal";
import DeleteMessageDialog from "../DeleteMessageDialog/DeleteMessageDialog";
import VoiceRecorder from "../VoiceRecorder/VoiceRecorder";
import { getAvatarColor } from "../../utils/avatarColor";
import { formatLastSeen } from "../../utils/formatLastSeen";
import { formatDateLabel } from "../../utils/formatDateLabel";
import PollModal from "../PollModal/PollModal";
import { api } from "../../utils/api";
import {
  isCloudinaryChatFileSupported,
  uploadChatFile,
} from "../../utils/imageUpload";
import CallLogBubble from "../CallLogBubble/CallLogBubble";
import MediaPreviewModal from "../MediaPreviewModal/MediaPreviewModal";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // must match the backend limit

const FILE_LABELS = {
  IMAGE: "📷 Photo",
  VIDEO: "🎥 Video",
  DOCUMENT: "📄 Document",
  AUDIO: "🎤 Voice message",
};

const CALL_BUTTONS = [
  { Icon: Phone, label: "Audio call", callType: "audio" },
  { Icon: Video, label: "Video call", callType: "video" },
];

const MATCH_BUTTONS = [
  { Icon: ChevronUp, direction: -1, title: "Older match" },
  { Icon: ChevronDown, direction: 1, title: "Newer match" },
];

const iconBtn = "rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition";
const pickerBtn =
  "hidden sm:flex items-center justify-center mb-2.5 text-gray-400 hover:text-white transition shrink-0";

const sameId = (a, b) => Number(a) === Number(b);

const appendUnique = (list, message) =>
  !message?.id || list.some((m) => sameId(m.id, message.id))
    ? list
    : [...list, message];

const canActOn = (m) => !m.deletedForEveryone && !m.deletedForMeLocally;

export default function ChatWindow({
  activeChat,
  onSend,
  onShowDetails,
  onBack,
}) {
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState(null); // files waiting in the preview window
  const [messages, setMessages] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [undoMessage, setUndoMessage] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [recording, setRecording] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [status, setStatus] = useState({ isOnline: false, lastSeen: null });
  const [, setTick] = useState(0);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // null = not uploading
  const [uploadError, setUploadError] = useState("");
  const [pastedImage, setPastedImage] = useState(null);
  const [smartReplies, setSmartReplies] = useState([]);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const smartReplyRequestRef = useRef(0);
  const searchInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const pickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const attachRef = useRef(null);
  const attachButtonRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messagesRef = useRef([]);
  const undoTimerRef = useRef(null);
  const { user, token } = useSelector((state) => state.auth);
  const isGroup = activeChat?.type === "GROUP";

  // ---------- calls ----------
  const calls = useCall(activeChat);

  // who a message / upload / poll is addressed to
  const target = isGroup
    ? { conversationId: activeChat?.conversationId }
    : { receiverId: activeChat?.id };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const patchMessage = (id, patch) =>
    setMessages((prev) =>
      prev.map((m) => (sameId(m.id, id) ? { ...m, ...patch } : m)),
    );

  // ---------- undo timer ----------
  useEffect(() => {
    if (!undoMessage) return;

    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setUndoMessage(null);
      setUndoing(false);
    }, 5000);

    return () => clearTimeout(undoTimerRef.current);
  }, [undoMessage]);

  // ---------- read receipts ----------
  const markAsRead = () => {
    if (!activeChat?.id || !socket.connected || document.hidden) return;

    if (isGroup) {
      return socket.emit("markRead", {
        conversationId: Number(activeChat.conversationId),
      });
    }

    const isUnread = (m) =>
      sameId(m.senderId, activeChat.id) && !m.readAt && !m.deletedForEveryone;
    if (!messagesRef.current.some(isUnread)) return;

    socket.emit("markRead", { senderId: activeChat.id });

    const now = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        sameId(m.senderId, activeChat.id) && !m.readAt
          ? { ...m, readAt: now }
          : m,
      ),
    );
  };

  useEffect(() => {
    markAsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeChat?.id]);

  useEffect(() => {
    const onVisible = () => !document.hidden && markAsRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // ---------- search ----------
  const matchIds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return messages
      .filter((m) => canActOn(m) && m.body?.toLowerCase().includes(query))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  const safeMatchIndex = matchIds.length
    ? Math.min(activeMatch, matchIds.length - 1)
    : 0;
  const activeMatchId = matchIds[safeMatchIndex];

  useEffect(() => {
    if (activeMatchId) {
      document
        .getElementById(`msg-${activeMatchId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeMatchId]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveMatch(0);
  };

  useEffect(() => {
    closeSearch();
  }, [activeChat?.id]);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const goToMatch = (direction) => {
    if (matchIds.length) {
      setActiveMatch(
        (safeMatchIndex + direction + matchIds.length) % matchIds.length,
      );
    }
  };

  // ---------- scroll ----------
  const isNearBottom = () => {
    const c = messagesContainerRef.current;
    return !c || c.scrollHeight - c.scrollTop - c.clientHeight < 100;
  };

  const scrollToBottom = (behavior = "smooth") => {
    const c = messagesContainerRef.current;
    c?.scrollTo({ top: c.scrollHeight, behavior });
  };

  const handleScroll = () => {
    const near = isNearBottom();
    setShowScrollButton(!near);
    if (near) setNewMessageCount(0);
  };

  const handleScrollButtonClick = () => {
    scrollToBottom("smooth");
    setNewMessageCount(0);
    setShowScrollButton(false);
  };

  // ---------- presence (direct chats only) ----------
  useEffect(() => {
    if (!activeChat?.id || isGroup) return;

    setStatus({ isOnline: false, lastSeen: null });

    const ask = () =>
      socket.connected && socket.emit("getPresence", { userId: activeChat.id });

    const onPresence = (data) => {
      if (sameId(data?.userId, activeChat.id)) {
        setStatus((prev) => ({
          isOnline: Boolean(data.isOnline),
          lastSeen: data.lastSeen ?? prev.lastSeen,
        }));
      }
    };

    ask();
    return listen({ presence: onPresence, connect: ask });
  }, [activeChat?.id, isGroup]);

  // refresh "last seen" text every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // ---------- typing (direct chats only for now) ----------
  useEffect(() => {
    setIsOtherTyping(false);
    if (!activeChat?.id || isGroup) return;

    let hideTimer;

    const onTyping = (data) => {
      if (!sameId(data?.userId, activeChat.id)) return;

      setIsOtherTyping(Boolean(data?.isTyping));
      clearTimeout(hideTimer);
      if (data?.isTyping)
        hideTimer = setTimeout(() => setIsOtherTyping(false), 5000);
    };

    const off = listen({ typing: onTyping });
    return () => {
      off();
      clearTimeout(hideTimer);
    };
  }, [activeChat?.id, isGroup]);

  const emitTyping = (isTyping, id = activeChat?.id) => {
    if (id && !isGroup) socket.emit("typing", { receiverId: id, isTyping });
  };

  const stopTyping = (id) => {
    clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) emitTyping(false, id);
    isTypingRef.current = false;
  };

  useEffect(() => {
    const chatId = activeChat?.id;
    return () => stopTyping(chatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!activeChat?.id || isGroup) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTyping(true);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => stopTyping(), 2000);
  };

  // ---------- textarea height ----------
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px";
  }, [input]);

  // ---------- load messages ----------
  useEffect(() => {
    setMessages([]);
    smartReplyRequestRef.current++;
    setNewMessageCount(0);
    setShowScrollButton(false);
    setDeleteTarget(null);
    setUndoMessage(null);
    setUndoing(false);
    clearTimeout(undoTimerRef.current);

    if (!activeChat?.id) return;

    const groupId = Number(activeChat.conversationId);

    const request = () =>
      socket.connected &&
      socket.emit(
        "getMessages",
        isGroup
          ? { conversationId: groupId }
          : { userId: Number(activeChat.id) },
      );

    const onMessages = (data) => {
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      if (isGroup && !document.hidden)
        socket.emit("markRead", { conversationId: groupId });
      setTimeout(() => scrollToBottom("auto"), 50);
    };

    request();

    return listen({
      messages: onMessages,
      messageError: (data) => console.error("Message error:", data?.error),
      connect: request,
    });
  }, [activeChat?.id, activeChat?.type, activeChat?.conversationId]);

  const generateSmartReplies = async (message) => {
    if (isGroup || !message?.body?.trim() || message.fileUrl) return;
    if (message.messageType && message.messageType !== "TEXT") return;

    const requestId = ++smartReplyRequestRef.current;
    setSmartReplies([]);

    try {
      const data = await api("/smart-replies", token, "POST", {
        message: message.body,
      });

      if (requestId === smartReplyRequestRef.current) {
        setSmartReplies(data.suggestions || []);
      }
    } catch (error) {
      console.error("Smart replies error:", error.message);
    }
  };
  // ---------- live message events ----------
  useEffect(() => {
    if (!activeChat?.id || !user?.id) return;

    // does this message belong to the open chat? (own = sent by me)
    const inChat = (m, own) => {
      if (isGroup)
        return (
          sameId(m.conversationId, activeChat.conversationId) &&
          sameId(m.senderId, user.id) === own
        );

      // direct chat: also accept messages from the bot in this same conversation
      if (
        !own &&
        activeChat.conversationId &&
        sameId(m.conversationId, activeChat.conversationId)
      )
        return !sameId(m.senderId, user.id);
      const [from, to] = own
        ? [user.id, activeChat.id]
        : [activeChat.id, user.id];
      return sameId(m.senderId, from) && sameId(m.receiverId, to);
    };

    const onSent = (m) => {
      if (!m?.id || !inChat(m, true)) return;

      setMessages((prev) => appendUnique(prev, m));
      setTimeout(() => scrollToBottom("smooth"), 50);
      setNewMessageCount(0);
      setShowScrollButton(false);
    };

    const onNew = (m) => {
      if (!m?.id || !inChat(m, false)) return;
      if (messagesRef.current.some((x) => sameId(x.id, m.id))) return;

      setIsOtherTyping(false);
      generateSmartReplies(m);

      const stick = isNearBottom();
      setMessages((prev) => appendUnique(prev, m));

      if (isGroup && !document.hidden) {
        socket.emit("markRead", {
          conversationId: Number(activeChat.conversationId),
        });
      }

      if (stick) {
        setTimeout(() => scrollToBottom("smooth"), 50);
      } else {
        setNewMessageCount((c) => c + 1);
        setShowScrollButton(true);
      }
    };

    const onDeleted = ({ messageId, mode }) => {
      const found = messagesRef.current.find((m) => sameId(m.id, messageId));
      if (!found) return;

      if (mode === "me") {
        patchMessage(messageId, { deletedForMeLocally: true });
      } else {
        patchMessage(messageId, { deletedForEveryone: true, body: "" });
        if (!sameId(found.senderId, user.id)) return; // only the sender can undo
      }

      setUndoMessage({ ...found, undoMode: mode });
      setUndoing(false);
    };

    const onRestored = (m) => {
      const id = Number(m.messageId ?? m.id);
      const restored = {
        ...m,
        id,
        deletedForEveryone: false,
        deletedForMeLocally: false,
      };

      setMessages((prev) =>
        prev.some((x) => sameId(x.id, id))
          ? prev.map((x) => (sameId(x.id, id) ? { ...x, ...restored } : x))
          : [...prev, restored],
      );

      setUndoMessage(null);
      setUndoing(false);
      clearTimeout(undoTimerRef.current);
    };

    const onRead = ({ readerId, readAt }) =>
      setMessages((prev) =>
        prev.map((m) =>
          sameId(m.senderId, user.id) &&
          sameId(m.receiverId, readerId) &&
          !m.readAt
            ? { ...m, readAt }
            : m,
        ),
      );

    // Update the sender and the viewer after a view-once item is opened.
    const onViewOnceOpened = ({ messageId, viewerId, expired }) => {
      if (expired) return patchMessage(messageId, { viewOnceState: "EXPIRED" });
      if (
        sameId(viewerId, user.id) ||
        messagesRef.current.some(
          (message) =>
            sameId(message.id, messageId) &&
            sameId(message.senderId, user.id),
        )
      )
        patchMessage(messageId, { viewOnceState: "OPENED" });
    };

    return listen({
      messageSent: onSent,
      newMessage: onNew,
      messageDeleted: onDeleted,
      messageRestored: onRestored,
      messageEdited: ({ messageId, body, editedAt }) =>
        patchMessage(messageId, { body, editedAt }),
      messagesRead: onRead,
      pollUpdated: ({ messageId, poll }) => patchMessage(messageId, { poll }),
      viewOnceOpened: onViewOnceOpened, // NEW
    });
  }, [activeChat?.id, activeChat?.type, activeChat?.conversationId, user?.id]);

  // ---------- actions ----------
  const handleDeleteConfirm = (mode) => {
    if (!deleteTarget) return;
    socket.emit("deleteMessage", { messageId: deleteTarget.id, mode });
    setDeleteTarget(null);
  };

  const handleUndoDelete = (message) => {
    if (!message || undoing || !sameId(undoMessage?.id, message.id)) return;

    setUndoing(true);
    socket.emit("undoDeleteMessage", {
      messageId: message.id,
      mode: undoMessage.undoMode,
    });
  };

  const handleReply = (message) => {
    if (!canActOn(message)) return;
    setReplyingTo(message);
    setEditingMessageId(null);
  };

  const handleEdit = (message) => {
    if (
      !sameId(message.senderId, user?.id) ||
      !canActOn(message) ||
      message.fileUrl ||
      message.viewOnce // NEW: view-once media cannot be edited
    )
      return;
    setEditingMessageId(message.id);
    setReplyingTo(null);
    setInput(message.body || "");
  };

  const cancelReplyOrEdit = () => {
    setReplyingTo(null);
    setEditingMessageId(null);
    setInput("");
  };
  // ---------- chat summary ----------
  const handleSummarize = async () => {
    if (summarizing) return;
    if (!activeChat?.conversationId) {
      setSummary("Send a message first, then summarize this chat.");
      return;
    }

    setSummarizing(true);
    setSummary("");
    try {
      const data = await api("/ai/summary", token, "POST", {
        conversationId: activeChat.conversationId,
      });
      setSummary((data.summary || "").replace(/\*\*/g, ""));
    } catch {
      setSummary("Could not summarize this chat. Try again.");
    } finally {
      setSummarizing(false);
    }
  };

  // hide the summary when you open another chat
  useEffect(() => {
    setSummary("");
  }, [activeChat?.id]);

  useEffect(() => {
    if (!pastedImage?.previewUrl) return;
    return () => URL.revokeObjectURL(pastedImage.previewUrl);
  }, [pastedImage?.previewUrl]);

  const handleSend = (e) => {
    e.preventDefault();

    const text = input.trim();
    const imageFile = pastedImage?.file;
    if (!text && !imageFile) return;
    if (text && !socket.connected)
      return console.error("Socket is not connected");

    if (imageFile) {
      uploadFile(imageFile);
      setPastedImage(null);
    }

    if (text) {
      if (editingMessageId) {
        socket.emit("editMessage", { messageId: editingMessageId, body: text });
        setEditingMessageId(null);
      } else if (replyingTo) {
        socket.emit("replyMessage", {
          receiverId: activeChat.id,
          body: text,
          replyToId: replyingTo.id,
        });
        setReplyingTo(null);
      } else {
        onSend(text);
      }

      setSmartReplies([]);
      smartReplyRequestRef.current++;
      setInput("");
      stopTyping();
      setShowEmojiPicker(false);
    }
  };

  // ---------- polls ----------
  const handleCreatePoll = (poll) => {
    if (!socket.connected) return console.error("Socket is not connected");

    socket.emit("createPoll", { ...poll, ...target });
    setShowPoll(false);
  };

  const handleVote = (pollId, optionId) =>
    socket.connected && socket.emit("votePoll", { pollId, optionId });

  // ---------- file upload ----------
  const showUploadError = (text) => {
    setUploadError(text);
    setTimeout(() => setUploadError(""), 4000);
  };

  // duration is only passed for voice notes (they skip Cloudinary and the progress bar)
  const uploadFile = async (file, duration, opts = {}) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE)
      return showUploadError("File is too large (max 50MB)");

    // View-once applies only to photos, videos, and voice notes.
   const sendViewOnce =
  Boolean(opts.viewOnce) &&
  (file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    Boolean(duration));// toggle turns off after sending, like WhatsApp

    if (!duration && isCloudinaryChatFileSupported(file)) {
      setUploadProgress(0);
      setUploadError("");
      try {
        const uploaded = await uploadChatFile(file, token, setUploadProgress);
        await api("/messages/cloudinary-file", token, "POST", {
          ...target,
          publicId: uploaded.public_id,
          fileName: file.name,
          mimeType: file.type,
          ...(sendViewOnce ? { viewOnce: true } : {}),
          ...(opts.caption ? { body: opts.caption } : {}),
        });
      } catch (error) {
        showUploadError(error.message || "File upload failed");
      } finally {
        setUploadProgress(null);
      }
      return;
    }

    const formData = new FormData();
formData.append("file", file);
if (duration) formData.append("duration", duration);
if (sendViewOnce) formData.append("viewOnce", "true"); // NEW
if (opts.caption) formData.append("body", opts.caption); // NEW
Object.entries(target).forEach(([key, value]) =>
  formData.append(key, value),
);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/messages/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Do not set Content-Type: the browser adds it for FormData.

    xhr.upload.onprogress = (e) => {
      if (!duration && e.lengthComputable)
        setUploadProgress(Math.round((e.loaded * 100) / e.total));
    };

    xhr.onload = () => {
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) return; // the socket event shows the message

      let text = "Upload failed";
      try {
        text = JSON.parse(xhr.responseText).error || text;
      } catch {
        // keep the default text
      }
      showUploadError(text);
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      showUploadError("Network error. Upload failed");
    };

    if (!duration) setUploadProgress(0); // no progress bar for voice notes
    xhr.send(formData);
  };

  const handlePaste = (event) => {
    const imageItem = Array.from(event.clipboardData?.items || []).find(
      (item) => item.type.startsWith("image/"),
    );
    const clipboardFile = imageItem?.getAsFile();
    if (!clipboardFile) return;

    event.preventDefault();
    const file = new File(
      [clipboardFile],
      clipboardFile.name || "screenshot.png",
      { type: clipboardFile.type || "image/png" },
    );
    setPastedImage({ file, previewUrl: URL.createObjectURL(file) });
    setUploadError("");
  };

  // ---------- voice notes ----------
  const sendVoice = (file, duration) => {
    setRecording(false);
    uploadFile(file, duration);
  };

  const cancelVoice = (errorText) => {
    setRecording(false);
    if (errorText) showUploadError(errorText);
  };

  // ---------- close emoji / attach pickers on outside click ----------
  useEffect(() => {
    if (!showEmojiPicker && !showAttachMenu) return;

    const outside = (ref, button, node) =>
      ref.current &&
      !ref.current.contains(node) &&
      button.current &&
      !button.current.contains(node);

    const onMouseDown = (e) => {
      if (showEmojiPicker && outside(pickerRef, emojiButtonRef, e.target))
        setShowEmojiPicker(false);
      if (showAttachMenu && outside(attachRef, attachButtonRef, e.target))
        setShowAttachMenu(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showEmojiPicker, showAttachMenu]);

  // ---------- UI ----------
  if (!activeChat) {
    return (
      <>
        <CallOverlay {...calls} />
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-(--app-bg) min-w-0 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-(--panel-bg) border border-(--border) flex items-center justify-center mb-4">
            <MessageCircle className="text-(--accent)" size={28} />
          </div>
          <h2 className="text-(--text-primary) font-semibold text-lg">
            Welcome to Talkora
          </h2>
          <p className="text-(--text-muted) text-sm mt-1">
            Choose a chat to start a conversation
          </p>
        </div>
      </>
    );
  }

  const userInitials =
    activeChat.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const editingBody = editingMessageId
    ? messages.find((m) => sameId(m.id, editingMessageId))?.body
    : null;

  const replyPreview =
    replyingTo?.body || FILE_LABELS[replyingTo?.messageType] || "Message";

  // empty input -> show the mic, text typed -> show the send arrow
  const showMic =
    !input.trim() && !replyingTo && !editingMessageId && !pastedImage;
  // "@" popup: shows while the text ends with @ (or @tal...)
  const mention = input.match(/(^|\s)@(\w*)$/);
  const showMentionPopup =
    Boolean(mention) &&
    activeChat.name !== "Talkora AI" &&
    "talkora".startsWith(mention[2].toLowerCase());

  const pickMention = () => {
    setInput(input.replace(/@\w*$/, "@Talkora AI "));
    textareaRef.current?.focus();
  };

  const showOnlineStyle = !isGroup && (isOtherTyping || status.isOnline);

  const statusText = isGroup
    ? `${activeChat.members?.length || 0} members`
    : isOtherTyping
      ? "typing..."
      : status.isOnline
        ? "Online"
        : formatLastSeen(status.lastSeen);

  return (
    <div className="flex-1 flex flex-col bg-(--app-bg) min-w-0">
      {/* HEADER */}
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
              src={activeChat.avatarUrl}
              alt={activeChat.name}
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-(--border)"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#F8FAFC] font-semibold text-sm shrink-0"
              style={{ backgroundColor: getAvatarColor(activeChat.id) }}
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
                showOnlineStyle ? "text-(--accent)" : "text-(--text-muted)"
              }`}
            >
              {!isGroup && !isOtherTyping && status.isOnline && (
                <span className="w-1.5 h-1.5 rounded-full bg-(--accent) shrink-0" />
              )}
              <span className="truncate">{statusText}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-gray-400 shrink-0">
          {CALL_BUTTONS.map(({ Icon, label, callType }) => (
            <button
              key={label}
              type="button"
              onClick={() => calls.startCall(callType)}
              aria-label={label}
              title={isGroup ? `${label} with group` : label}
              className={`hidden sm:flex items-center justify-center ${iconBtn}`}
            >
              <Icon size={18} />
            </button>
          ))}
          <button
            type="button"
            onClick={handleSummarize}
            disabled={summarizing}
            title="Summarize this chat"
            className={`flex items-center gap-1.5 rounded-lg border border-(--border) px-2.5 py-1.5 text-xs font-medium text-(--accent) hover:border-(--accent) transition ${
              summarizing ? "opacity-60" : ""
            }`}
          >
            <Sparkles size={15} />
            <span className="hidden sm:inline">Summarize</span>
          </button>
          <button
            type="button"
            onClick={searchOpen ? closeSearch : openSearch}
            className={`${iconBtn} ${searchOpen ? "text-(--accent)" : ""}`}
            title="Search in chat"
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            onClick={onShowDetails}
            className="rounded-lg p-1 hover:bg-[#334155] hover:text-white transition"
            title={isGroup ? "Group info" : "View chat details"}
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* SEARCH */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2 border-b border-(--border) bg-(--panel-bg)">
          <Search size={16} className="text-(--text-muted) shrink-0" />

          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveMatch(Number.MAX_SAFE_INTEGER);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                goToMatch(e.shiftKey ? 1 : -1);
              }
              if (e.key === "Escape") closeSearch();
            }}
            placeholder="Search in this chat..."
            className="flex-1 min-w-0 bg-transparent text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none"
          />

          {searchQuery.trim() && (
            <span className="text-xs text-(--text-muted) shrink-0">
              {matchIds.length
                ? `${safeMatchIndex + 1} of ${matchIds.length}`
                : "No results"}
            </span>
          )}

          {MATCH_BUTTONS.map(({ Icon, direction, title }) => (
            <button
              key={title}
              type="button"
              onClick={() => goToMatch(direction)}
              disabled={!matchIds.length}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-40"
              title={title}
            >
              <Icon size={18} />
            </button>
          ))}
          <button
            type="button"
            onClick={closeSearch}
            className="p-1 text-gray-400 hover:text-white"
            title="Close search"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {/* CHAT SUMMARY */}
      {(summarizing || summary) && (
        <div className="px-3 sm:px-5 pt-3">
          <div className="rounded-xl border border-(--accent)/40 bg-(--accent)/10 px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-(--accent)">
                <Sparkles size={16} />
                <span className="text-sm font-medium">Chat summary</span>
              </div>

              {!summarizing && (
                <div className="flex items-center gap-2 text-(--text-muted)">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(summary)}
                    title="Copy summary"
                    className="hover:text-(--text-primary)"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummary("")}
                    title="Close"
                    className="hover:text-(--text-primary)"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-(--text-primary)">
              {summarizing ? "Summarizing..." : summary}
            </p>

            {!summarizing && (
              <p className="mt-2 text-[11px] text-(--text-muted)">
                Made by Talkora AI. Only you can see this.
              </p>
            )}
          </div>
        </div>
      )}
      {/* MESSAGES */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="custom-scrollbar h-full overflow-y-auto px-3 sm:px-5 py-4"
        >
          {messages.length > 0 ? (
            messages.map((message, index) => {
              const isOwn = sameId(message.senderId, user?.id);
              const previous = messages[index - 1];
              const showDate =
                !previous ||
                !isSameDay(
                  new Date(previous.createdAt),
                  new Date(message.createdAt),
                );
              const deliveryState = !isOwn
                ? "none"
                : message.readAt
                  ? "read"
                  : status.isOnline
                    ? "delivered"
                    : "sent";

              return (
                <Fragment key={message.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] text-(--text-muted) bg-(--panel-bg) border border-(--border) px-3 py-1 rounded-full">
                        {formatDateLabel(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <div id={`msg-${message.id}`}>
                    {message.messageType === "CALL" ? (
                      <CallLogBubble
                        message={message}
                        isOwn={isOwn}
                        menuUp={index >= messages.length - 2}
                        onDelete={() => setDeleteTarget(message)}
                        onUndo={() => handleUndoDelete(message)}
                        canUndo={
                          sameId(undoMessage?.id, message.id) &&
                          (isOwn || undoMessage?.undoMode === "me")
                        }
                      />
                    ) : (
                      <ChatBubble
                        message={message}
                        isOwn={isOwn}
                        menuUp={index >= messages.length - 2}
                        onDelete={() => setDeleteTarget(message)}
                        onReply={() => handleReply(message)}
                        onEdit={() => handleEdit(message)}
                        onUndo={() => handleUndoDelete(message)}
                        canUndo={sameId(undoMessage?.id, message.id)}
                        searchQuery={searchQuery}
                        isActiveMatch={sameId(message.id, activeMatchId)}
                        deliveryState={deliveryState}
                        currentUserId={user?.id}
                        onVote={handleVote}
                      />
                    )}
                  </div>{" "}
                </Fragment>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-(--panel-bg) border border-(--border) flex items-center justify-center mb-3">
                <MessageCircle className="text-(--accent)" size={24} />
              </div>
              <p className="text-(--text-primary) text-sm font-medium">
                No messages yet
              </p>
              <p className="text-(--text-muted) text-xs mt-1">
                Start a conversation with {activeChat.name}
              </p>
            </div>
          )}
        </div>

        {showScrollButton && (
          <button
            type="button"
            onClick={handleScrollButtonClick}
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
            className="absolute bottom-4 right-4 sm:right-6 w-10 h-10 rounded-full bg-(--panel-bg) border border-(--border) text-(--text-primary) shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition z-10"
          >
            <ChevronDown size={20} />
            {newMessageCount > 0 && (
              <span className="absolute -top-2 -right-1 min-w-5 h-5 px-1 rounded-full bg-(--accent) text-[#F8FAFC] text-[11px] font-semibold flex items-center justify-center">
                {newMessageCount > 99 ? "99+" : newMessageCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* REPLY / EDIT BAR */}
      {(replyingTo || editingMessageId) && (
        <div className="flex items-center justify-between gap-3 border-t border-(--border) bg-(--panel-bg) px-3 sm:px-5 pt-2 pb-1">
          <div className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--input-bg) px-3 py-2 text-xs text-(--text-muted)">
            <div className="font-medium uppercase tracking-[0.08em]">
              {editingMessageId ? "Editing message" : "Replying to"}
            </div>
            <div className="mt-0.5 truncate text-(--text-primary)">
              {(editingMessageId ? editingBody : replyPreview) || "Message"}
            </div>
          </div>

          <button
            type="button"
            onClick={cancelReplyOrEdit}
            className="rounded-lg p-1.5 text-(--text-muted) hover:bg-white/5 hover:text-(--text-primary)"
            aria-label="Cancel reply or edit"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {pastedImage && (
        <div className="flex items-center gap-3 border-t border-(--border) bg-(--panel-bg) px-3 py-2 sm:px-5">
          <img
            src={pastedImage.previewUrl}
            alt="Screenshot ready to send"
            className="h-16 w-16 rounded-lg border border-(--border) object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-sm text-(--text-secondary)">
            Screenshot ready to send
          </span>
          <button
            type="button"
            onClick={() => setPastedImage(null)}
            aria-label="Remove pasted screenshot"
            title="Remove screenshot"
            className="rounded-lg p-1.5 text-(--text-muted) hover:bg-white/5 hover:text-(--text-primary)"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* UPLOAD PROGRESS / ERROR */}
      {(uploadProgress !== null || uploadError) && (
        <div className="px-3 sm:px-5 py-2 border-t border-(--border) bg-(--panel-bg) text-xs">
          {uploadError ? (
            <p className="text-red-400">{uploadError}</p>
          ) : (
            <div>
              <p className="text-(--text-muted) mb-1">
                Uploading... {uploadProgress}%
              </p>
              <div className="h-1.5 w-full rounded-full bg-(--input-bg) overflow-hidden">
                <div
                  className="h-full bg-(--accent) transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      {!isGroup &&
        !input.trim() &&
        !isOtherTyping &&
        !replyingTo &&
        !editingMessageId &&
        smartReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 sm:px-5 py-2 border-t border-(--border) bg-(--panel-bg)">
            {smartReplies.map((reply, index) => (
              <button
                key={`${index}-${reply}`}
                type="button"
                onClick={() => {
                  setInput(reply);
                  setSmartReplies([]);
                  textareaRef.current?.focus();
                }}
                className="rounded-full border border-(--border) px-3 py-2 text-sm text-(--text-primary) hover:border-(--accent) transition"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
      {/* MESSAGE INPUT */}
      <form
        onSubmit={handleSend}
        className="relative flex items-end gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-t border-(--border) bg-(--panel-bg)"
      >
        {recording ? (
          <VoiceRecorder onSend={sendVoice} onCancel={cancelVoice} />
        ) : (
          <>
            <button
              ref={attachButtonRef}
              type="button"
              onClick={() => setShowAttachMenu((v) => !v)}
              className={`${pickerBtn} ${showAttachMenu ? "text-(--accent)" : ""}`}
              title="Attach"
            >
              <Paperclip size={20} />
            </button>

            {showAttachMenu && (
              <div
                ref={attachRef}
                className="absolute bottom-full left-3 mb-2 z-30"
              >
                <AttachmentMenu
                  onSelectFiles={(type, files) => {
                    setShowAttachMenu(false);
                    const visual = Array.from(files).filter(
                      (file) =>
                        file.type.startsWith("image/") ||
                        file.type.startsWith("video/"),
                    );
                    if (visual.length) setPendingFiles(visual);
                    else uploadFile(files[0]);
                  }}
                  onAction={(id) => {
                    setShowAttachMenu(false);
                    if (id === "camera") setShowCamera(true);
                    if (id === "poll") setShowPoll(true);
                  }}
                />
              </div>
            )}

            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className={`${pickerBtn} ${showEmojiPicker ? "text-(--accent)" : ""}`}
              title="Insert emoji"
            >
              <Smile size={20} />
            </button>

            {showEmojiPicker && (
              <div
                ref={pickerRef}
                className="absolute bottom-full left-3 sm:left-16 mb-2 z-30"
              >
                <EmojiPicker
                  onSelect={(emoji) => setInput((prev) => prev + emoji)}
                />
              </div>
            )}
            {showMentionPopup && (
              <button
                type="button"
                onClick={pickMention}
                className="absolute bottom-full left-3 sm:left-5 mb-2 z-30 flex items-center gap-2 rounded-xl border border-(--border) bg-(--panel-bg) px-3 py-2 text-sm text-(--text-primary) shadow-lg hover:border-(--accent) transition"
              >
                <Bot size={18} className="text-(--accent)" />
                Talkora AI
              </button>
            )}

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={`Message ${activeChat.name}...`}
              className="flex-1 resize-none max-h-32 px-4 py-2.5 bg-(--input-bg) border border-(--border) rounded-3xl text-sm text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent"
            />

            <button
              type={showMic ? "button" : "submit"}
              onClick={showMic ? () => setRecording(true) : undefined}
              disabled={!showMic && !input.trim() && !pastedImage}
              title={showMic ? "Record voice note" : "Send"}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-(--accent) text-[#F8FAFC] shrink-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {showMic ? <Mic size={18} /> : <Send size={16} />}
            </button>
          </>
        )}
      </form>

      {showPoll && (
        <PollModal
          onClose={() => setShowPoll(false)}
          onCreate={handleCreatePoll}
        />
      )}
      {showCamera && (
        <CameraModal
          onCapture={(file) => {
            setShowCamera(false);
            setPendingFiles([file]);
          }}
        />
      )}
      <CallOverlay {...calls} />
      <DeleteMessageDialog
        message={deleteTarget}
        isOwn={deleteTarget ? sameId(deleteTarget.senderId, user?.id) : false}
        onDelete={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}