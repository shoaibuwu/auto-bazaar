import express from "express";
import { askAiAdvisor, syncEmbeddings } from "../controllers/aiAdvisor.controller.js";

const router = express.Router();

// Public RAG search endpoint for hero & chat
router.post("/ask", askAiAdvisor);

// Embedding sync endpoint
router.post("/sync-embeddings", syncEmbeddings);

export default router;

