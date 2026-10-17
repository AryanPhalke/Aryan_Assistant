import { getAuth } from "firebase-admin/auth";
import { app } from "../firebase.js";
import User from "../modal/user.model.js";
import redis from "../../../shared/redis/redis.js";

// Sessions last 7 days. Redis wants seconds, cookies want milliseconds.
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

// LOGIN
// 1. Frontend signs in with Google and sends us the Firebase ID token
// 2. We verify the token, then find or create the user in MongoDB
// 3. We create a session in Redis and give the browser a cookie pointing to it
export const login = async (req, res) => {
  try {
    const { token } = req.body;

    // Throws if the token is fake or expired. decoded holds the Google profile.
    const decoded = await getAuth(app).verifyIdToken(token);

    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    // First time this person logs in: create their account
    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        name: decoded.name,
        email: decoded.email,
        avatar: decoded.picture,
      });
      console.log(`[auth:login] New user created: ${user.email}`);
    }

    // Random, unguessable id that represents this login
    const sessionId = crypto.randomUUID();

    // Save the user's info in Redis under session:<id>.
    // "EX" + seconds tells Redis to auto-delete it after 7 days.
    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      }),
      "EX",
      SESSION_TTL_SECONDS,
    );

    // Send the session id to the browser as a cookie.
    // httpOnly: JavaScript in the page cannot read it (protects against XSS)
    // sameSite strict: only sent for requests from our own site
    // secure: false because we're on http://localhost; set true in production (HTTPS)
    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: SESSION_TTL_SECONDS * 1000,
    });

    console.log(`[auth:login] Session created for ${user.email}`);
    return res.status(200).json(user);
  } catch (error) {
    console.error("[auth:login] Login failed:", error.message);
    return res.status(500).json({ message: `login error ${error}` });
  }
};

// LOGOUT
// Deletes the session from Redis (so the cookie becomes useless) and clears
// the cookie from the browser.
export const logOut = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;
    await redis.del(`session:${sessionId}`);

    res.clearCookie("session");
    console.log("[auth:logout] Session deleted");
    return res.status(200).json({ message: "logout successfully" });
  } catch (error) {
    console.error("[auth:logout] Logout failed:", error.message);
    return res.status(500).json({ message: `logout error ${error}` });
  }
};
