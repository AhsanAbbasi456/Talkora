import { api } from "./api";

async function uploadSignedAsset(file, token, resourceType, onProgress) {
  const sig = await api("/cloudinary/signature", token);
  if (!sig.cloudName || !sig.apiKey || !sig.signature || !sig.timestamp) {
    throw new Error("The file upload service returned incomplete signing information.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", sig.timestamp);
  form.append("signature", sig.signature);

  const json = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`
    );
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded * 100) / event.total));
      }
    };
    xhr.onload = () => {
      let response;
      try {
        response = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Cloudinary returned an invalid response."));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(response?.error?.message || `Cloudinary rejected the file (HTTP ${xhr.status}).`));
        return;
      }
      resolve(response);
    };
    xhr.onerror = () => reject(new Error("Could not reach Cloudinary."));
    xhr.send(form);
  });

  if (!json?.secure_url || !json?.public_id) {
    throw new Error("Cloudinary did not return a saved file.");
  }
  return json;
}

// Checks the image, uploads it to Cloudinary and returns its URL.
export async function uploadImage(file, token) {
  if (!file) throw new Error("Choose an image to upload.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Please choose a JPG, PNG or WEBP image.");
  }
  if (file.size > 7 * 1024 * 1024) throw new Error("Image must be smaller than 7 MB.");

  return (await uploadSignedAsset(file, token, "image")).secure_url;
}

const CHAT_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
]);

export const isCloudinaryChatFileSupported = (file) =>
  Boolean(file && CHAT_FILE_TYPES.has(file.type));

export async function uploadChatFile(file, token, onProgress) {
  if (!isCloudinaryChatFileSupported(file)) {
    throw new Error("This file type is not supported.");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("File is too large (max 50MB).");
  }

  const resourceType = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
    ? "video"
    : "raw";
  return uploadSignedAsset(file, token, resourceType, onProgress);
}