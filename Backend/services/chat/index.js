import "dotenv/config";
import express from "express";
// import cookieParser from "cookie-parser";
import connectDb from "./config/db.js";
import router from "./routes/chat.routes.js";
// import authRouter from "./routes/auth.route.js";

const port = process.env.PORT;
const app = express();

app.use(express.json()); // parse JSON request bodies into req.body
// app.use(cookieParser()); // parse cookies into req.cookies

app.use("/", router);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Hello from chat" });
});

// Mounted at "/" because the gateway already strips the "/api/auth" prefix:
// /api/auth/login (browser) -> /login (here)
// app.use("/", authRouter);

app.listen(port, () => {
  console.log(`[chat] Chat service running on port ${port}`);
  connectDb(); // connect to MongoDB once the server is up
});
