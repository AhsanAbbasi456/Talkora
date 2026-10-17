import { useEffect, useRef, useState } from "react";
import { X, Camera, RefreshCw, Send, RotateCcw } from "lucide-react";

export default function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [facingMode, setFacingMode] = useState("user"); // "user" = front, "environment" = back
  const [photo, setPhoto] = useState(null); // { blob, url } after taking a picture
  const [error, setError] = useState("");

  // Start the camera (and stop it again when we leave / switch / take a photo)
  useEffect(() => {
    if (photo) return;

    let cancelled = false;

    const startCamera = async () => {
      try {
        setError("");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setError("Could not open the camera. Please allow camera permission and try again.");
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode, photo]);

  // Clean up the preview image URL
  useEffect(() => {
    return () => {
      if (photo?.url) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  const takePhoto = async () => {
    // Method 1: ask the camera for a real photo (avoids the black-frame problem)
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && "ImageCapture" in window) {
      try {
        const blob = await new ImageCapture(track).takePhoto();
        setPhoto({ blob, url: URL.createObjectURL(blob) });
        return;
      } catch {
        // not supported on this camera/browser, use Method 2 below
      }
    }

    // Method 2: copy the current video frame (old method, used as backup)
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;

    await new Promise((resolve) => {
      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(() => resolve());
      } else {
        requestAnimationFrame(() => resolve());
      }
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) setPhoto({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.9
    );
  };

  const sendPhoto = () => {
    if (!photo) return;
    const file = new File([photo.blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture?.(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-(--border) bg-(--panel-bg) shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--border)">
          <p className="text-sm font-medium text-(--text-primary)">
            {photo ? "Preview" : "Take a photo"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition"
            aria-label="Close camera"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera / Preview area */}
        <div className="relative flex aspect-video items-center justify-center bg-black">
          {error ? (
            <p className="px-6 text-center text-sm text-red-400">{error}</p>
          ) : photo ? (
            <img src={photo.url} alt="Captured" className="h-full w-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-contain"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-4 px-4 py-4">
          {photo ? (
            <>
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="flex items-center gap-2 rounded-full border border-(--border) px-4 py-2 text-sm text-(--text-primary) hover:bg-white/5 transition"
              >
                <RotateCcw size={16} /> Retake
              </button>
              <button
                type="button"
                onClick={sendPhoto}
                className="flex items-center gap-2 rounded-full bg-(--accent) px-5 py-2 text-sm font-medium text-[#F8FAFC] hover:scale-105 active:scale-95 transition"
              >
                <Send size={16} /> Send
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
                disabled={!!error}
                className="rounded-full p-3 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40 transition"
                title="Switch camera"
              >
                <RefreshCw size={20} />
              </button>
              <button
                type="button"
                onClick={takePhoto}
                disabled={!!error}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg hover:scale-105 active:scale-95 disabled:opacity-40 transition"
                title="Take photo"
              >
                <Camera size={26} />
              </button>
              <div className="w-11" /> {/* spacer to keep the shutter centered */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}