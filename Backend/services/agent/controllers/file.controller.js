import { getFileUrl } from "../config/s3.js";

// Path saved in messages for a file in S3. It never expires, unlike S3 links:
// the browser loads it through the gateway and gets redirected to a fresh
// pre-signed link each time (see getFile below).
export const filePath = (key) => `/api/agent/files/${key}`;

// GET /files/<key>, e.g. /files/images/<userId>/1730000000000-image.jpg
// Redirects to a temporary S3 link, so <img src> and downloads just work
// while the bucket stays private.
export const getFile = async (req, res) => {
  // Express 5 gives the "*key" part as a list of path segments
  const key = req.params.key.join("/");

  // Keys look like "<folder>/<userId>/<file>": only the owner can open them
  const owner = key.split("/")[1];
  if (!owner || owner !== req.headers["x-user-id"]) {
    return res.status(404).json({ message: "File not found" });
  }

  try {
    const url = await getFileUrl(key);
    // Let the browser reuse this redirect for a while (links last 1 hour)
    res.set("Cache-Control", "private, max-age=3000");
    return res.redirect(302, url);
  } catch (error) {
    console.error("[agent:files] Failed to create link:", error.message);
    return res.status(500).json({ message: "Could not load the file" });
  }
};
