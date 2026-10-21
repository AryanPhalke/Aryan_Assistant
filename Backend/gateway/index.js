// ---------------------------------------------------------------------------
// API GATEWAY
// The single entry point for the frontend. The browser only ever talks to this
// server; it either answers itself (e.g. /api/me) or forwards ("proxies") the
// request to the right microservice (e.g. /api/auth -> auth service).
// ---------------------------------------------------------------------------
import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
import protect from "./middleware/auth.middleware.js";
import getCurrentUser from "./controllers/user.controller.js";
import { proxyWithHeader } from "./utils/proxyWithHeader.js";

// Load variables from .env into process.env (PORT, FORNTEND_URL, AUTH_Service, REDIS_URL)
dotenv.config();

const port = process.env.PORT;
const app = express();

// CORS: only allow our frontend to call this server.
// `credentials: true` lets the browser send/receive the session cookie.
app.use(
  cors({
    origin: process.env.FORNTEND_URL,
    credentials: true,
  }),
);

// Parses the "Cookie" header so we can read req.cookies.session
app.use(cookieParser());

// Anything starting with /api/auth (login, logout) is forwarded to the auth service
app.use("/api/auth", proxy(process.env.AUTH_Service));

app.use("/api/chat", protect, proxyWithHeader(process.env.CHAT_Service));
app.use("/api/agent", protect, proxy(process.env.AGENT_Service));

// Returns the logged-in user's info. `protect` runs first and blocks the
// request unless a valid session exists in Redis.
app.get("/api/me", protect, getCurrentUser);

// Simple health check to confirm the gateway is up
app.get("/", (req, res) => {
  res.json({ message: "Hello from gateway" });
});

app.listen(port, () => {
  console.log(`[gateway] Server running on port ${port}`);
});
