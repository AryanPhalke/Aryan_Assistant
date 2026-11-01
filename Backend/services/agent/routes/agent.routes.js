import express from "express";
import { runAgent, streamAgent } from "../controllers/agent.controller.js";

const router = express.Router();

router.post("/chat", runAgent);
// Same as /chat but streams the reply token by token (Server-Sent Events)
router.post("/chat/stream", streamAgent);

export default router;
