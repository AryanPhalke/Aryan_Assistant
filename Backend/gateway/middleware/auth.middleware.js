import redis from "../../shared/redis/redis.js";
const protect = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.session;
    if (!sessionId) {
      //not authenticated
      return res
        .status(400)
        .json({ message: "session not found, not authenticated" });
    }
    const session = await redis.get(`session:${sessionId}`);
    if (!session) {
      //session expired after 7 days
      return res.status(400).json({ message: "session expired" });
    }
    req.user = JSON.parse(session);
    next();
  } catch (error) {
    return res.status(500).json({ message: `protect error ${error}` });
  }
};

export default protect;
