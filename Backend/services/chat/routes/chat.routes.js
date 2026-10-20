import express from "express";
import {
  createConversation,
  getConversation,
  getMessage,
  saveMessage,
  updateConversation,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/create-conversation", createConversation);
router.get("/get-conversation", getConversation);
router.post("/update-conversation", updateConversation);
router.post("/save-messages", saveMessage);
router.get("/get-messages/:conversationId", getMessage);

export default router;
