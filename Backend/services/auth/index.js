// ---------------------------------------------------------------------------
// AUTH SERVICE
// Handles login/logout. It is not called by the browser directly: the gateway
// forwards /api/auth/* requests here.
// ---------------------------------------------------------------------------
import "dotenv/config"; // loads .env (PORT, MONGODB_URI, REDIS_URL)
import express from "express";
import cookieParser from "cookie-parser";
import connectDb from "./config/db.js";
import authRouter from "./routes/auth.route.js";

const port = process.env.PORT;
const app = express();

app.use(express.json()); // parse JSON request bodies into req.body
app.use(cookieParser()); // parse cookies into req.cookies

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Hello from auth" });
});

// Mounted at "/" because the gateway already strips the "/api/auth" prefix:
// /api/auth/login (browser) -> /login (here)
app.use("/", authRouter);

app.listen(port, () => {
  console.log(`[auth] Server running on port ${port}`);
  connectDb(); // connect to MongoDB once the server is up
});
