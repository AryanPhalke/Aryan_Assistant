import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
dotenv.config();

const port = process.env.PORT;
const app = express();
app.use(
  cors({
    origin: process.env.FORNTEND_URL,
    credentials: true,
  }),
);

app.use(cookieParser());
app.use("/auth", proxy(process.env.AUTH_Service));

app.get("/", (req, res) => {
  res.json({ message: "Hello from gateway" });
});

app.listen(port, () => {
  console.log(`gateway started at ${port}`);
});
