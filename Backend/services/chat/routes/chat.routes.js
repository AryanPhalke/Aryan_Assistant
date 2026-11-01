import express from "express";
import {
  createConversation,
  deleteConversation,
  getConversation,
  getMessage,
  saveMessage,
  updateConversation,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/create-conversation", createConversation);
router.get("/get-conversation", getConversation);
router.post("/update-conversation", updateConversation);
router.delete("/delete-conversation/:id", deleteConversation);
router.post("/save-messages", saveMessage);
router.get("/get-messages/:conversationId", getMessage);

export default router;
