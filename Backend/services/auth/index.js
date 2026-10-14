import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js";
dotenv.config();

const port = process.env.PORT;
const app = express();
app.use(express.json);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Hello from auth" });
});

app.listen(port, () => {
  console.log(`auth started at ${port}`);
  connectDb();
});
