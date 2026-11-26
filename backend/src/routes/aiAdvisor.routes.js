import express from "express";
import {
  askAiAdvisor,
  syncEmbeddings,
  mcpChat,
  mcpChatStream,
  getMcpTools,
} from "../controllers/aiAdvisor.controller.js";

const router = express.Router();

// MCP-powered AI Chat (JSON + SSE Stream) & Tool Discovery endpoints
router.post("/mcp-chat", mcpChat);
router.post("/mcp-chat/stream", mcpChatStream);
router.get("/mcp-tools", getMcpTools);

// Legacy Local RAG endpoints (kept intact while RAG UI is hidden)
router.post("/ask", askAiAdvisor);
router.post("/sync-embeddings", syncEmbeddings);

export default router;

