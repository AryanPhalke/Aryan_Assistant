import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import connectDb from "./config/db.js";
import authRouter from "./routes/auth.route.js";

const port = process.env.PORT;
const app = express();
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Hello from auth" });
});
app.use("/", authRouter);
app.listen(port, () => {
  console.log(`auth started at ${port}`);
  connectDb();
});
