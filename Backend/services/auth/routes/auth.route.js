import express from "express";
import { login, logOut } from "../controllers/auth.controller.js";
const router = express.Router();

// POST /login  -> verify Firebase token, create session
router.post("/login", login);

// GET /logout  -> delete session
router.get("/logout", logOut);

export default router;
