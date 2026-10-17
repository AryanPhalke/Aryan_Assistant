import redis from "../../shared/redis/redis.js";

// Middleware that guards private routes.
// Flow: read session cookie -> look it up in Redis -> attach user to req -> next()
// If anything is missing, we respond with an error and never call next(),
// so the protected route handler is never reached.
const protect = async (req, res, next) => {
  try {
    // The cookie was set by the auth service at login (see auth.controller.js)
    const sessionId = req.cookies?.session;
    if (!sessionId) {
      // No cookie at all: the user never logged in (or cleared cookies)
      console.warn("[gateway:protect] Rejected: no session cookie on request");
      return res
        .status(400)
        .json({ message: "session not found, not authenticated" });
    }

    // Key format must match what the auth service saves: `session:<id>`
    const session = await redis.get(`session:${sessionId}`);
    if (!session) {
      // Cookie exists but Redis has no entry: expired (7 days), logged out, or fake
      console.warn("[gateway:protect] Rejected: session expired or invalid");
      return res.status(400).json({ message: "session expired" });
    }

    // Redis stores strings, so turn the JSON back into an object and expose it
    // to later handlers as req.user (e.g. getCurrentUser)
    req.user = JSON.parse(session);
    next(); // user is authenticated, continue to the route handler
  } catch (error) {
    console.error("[gateway:protect] Unexpected error:", error.message);
    return res.status(500).json({ message: `protect error ${error}` });
  }
};

export default protect;
