import express from "express";
import { runAgent, streamAgent } from "../controllers/agent.controller.js";
import { getFile } from "../controllers/file.controller.js";

const router = express.Router();

router.post("/chat", runAgent);
// Same as /chat but streams the reply token by token (Server-Sent Events)
router.post("/chat/stream", streamAgent);
// Files the agents saved in S3 (generated images); redirects to a temporary link
router.get("/files/*key", getFile);

export default router;
