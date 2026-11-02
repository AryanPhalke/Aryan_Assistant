import { buildKey, uploadFile, getFileUrl } from "../config/s3.js";

// Content types for the files the agents generate, picked from the file
// extension when the caller doesn't pass one
const CONTENT_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

// S3 folder for each kind of file, so the bucket stays organised
const FOLDERS = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt",
};

// One-call upload for agents: builds a unique per-user key, uploads the file
// and returns a temporary link the frontend can show right away.
//
//   const file = await uploadToS3({ userId, fileName: "notes.pdf", body: pdfBuffer });
//   -> { key, url, fileName, contentType, size }
//
// Save `key` in MongoDB (with the message); `url` expires after 1 hour, so
// create a fresh one with getFileUrl(key) when the file is shown again.
const uploadToS3 = async ({ userId, fileName, body, contentType, folder }) => {
  if (!userId) throw new Error("uploadToS3: userId is required");
  if (!fileName) throw new Error("uploadToS3: fileName is required");
  if (!body) throw new Error("uploadToS3: body is required");

  const extension = fileName.split(".").pop().toLowerCase();
  const type = contentType || CONTENT_TYPES[extension] || "application/octet-stream";
  // e.g. "pdf", "ppt" or "images"; anything unknown goes in "files"
  const dir = folder || FOLDERS[type] || (type.startsWith("image/") ? "images" : "files");

  const key = buildKey(dir, userId, fileName);
  await uploadFile(key, body, type);
  const url = await getFileUrl(key);

  return {
    key,
    url,
    fileName,
    contentType: type,
    size: Buffer.isBuffer(body) ? body.length : undefined,
  };
};

export default uploadToS3;
