import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 helpers for generated images and PDFs.
// Credentials come from AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
// in .env (the SDK reads them automatically); the bucket from S3_BUCKET.

const BUCKET = process.env.S3_BUCKET;

// Pre-signed links expire after this many seconds (1 hour)
const URL_EXPIRES_IN = 60 * 60;

// Created on first use, not at import: `new S3Client()` throws when
// AWS_REGION is missing, which would crash the whole agent service on startup
let client;
const getClient = () => {
  if (!process.env.AWS_REGION || !BUCKET) {
    throw new Error("S3 is not configured: set AWS_REGION and S3_BUCKET in .env");
  }
  client ??= new S3Client({ region: process.env.AWS_REGION });
  return client;
};

// Warn at startup so a missing setting is easy to spot
if (!BUCKET || !process.env.AWS_REGION) {
  console.warn("[agent:s3] S3_BUCKET or AWS_REGION is not set; uploads will fail");
}

// Builds a unique, per-user key (the file's path in the bucket), e.g.
// "pdf/6ad3655af0a24ca9817b3b73/1730000000000-notes.pdf". The timestamp
// stops two files with the same name overwriting each other.
export const buildKey = (folder, userId, fileName) => {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${folder}/${userId}/${Date.now()}-${safeName}`;
};

// Uploads a file and returns its key. Save the key (not a URL) in MongoDB:
// links expire, keys don't.
// body: Buffer, string or stream; contentType: e.g. "application/pdf", "image/png"
export const uploadFile = async (key, body, contentType) => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
};

// Returns a temporary link to a private file, so the browser can show or
// download it without the bucket being public. Create a fresh link each
// time the file is shown, since links expire.
export const getFileUrl = (key, expiresIn = URL_EXPIRES_IN) =>
  getSignedUrl(getClient(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn,
  });

// Deletes a file (e.g. when its conversation is deleted)
export const deleteFile = (key) =>
  getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
