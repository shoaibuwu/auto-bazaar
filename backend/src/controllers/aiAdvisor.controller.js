import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  chatWithLocalRAG,
  syncAllCarEmbeddings,
  syncCarEmbedding,
} from "../services/localAi.service.js";
import {
  chatWithMcp,
  streamChatWithMcp,
  listAutobazaarMcpTools,
} from "../services/mcpChat.service.js";

/**
 * @desc    Ask AutoBazaar Local AI Advisor (RAG)
 * @route   POST /api/v1/ai/ask
 * @access  Public
 */
export const askAiAdvisor = asyncHandler(async (req, res) => {
  const { query, history = [] } = req.body;

  if (!query || typeof query !== "string" || !query.trim()) {
    throw new ApiError(400, "A valid question or search query is required");
  }

  const result = await chatWithLocalRAG({
    query: query.trim(),
    conversationHistory: Array.isArray(history) ? history : [],
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "AI recommendations generated successfully"));
});

/**
 * @desc    Trigger sync of vector embeddings for published cars
 * @route   POST /api/v1/ai/sync-embeddings
 * @access  Public / Admin
 */
export const syncEmbeddings = asyncHandler(async (req, res) => {
  const result = await syncAllCarEmbeddings();
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Car embeddings synced successfully"));
});

/**
 * @desc    Chat with AutoBazaar AI via local MCP Server + Ollama tool calling
 * @route   POST /api/v1/ai/mcp-chat
 * @access  Public
 */
export const mcpChat = asyncHandler(async (req, res) => {
  const { query, history = [] } = req.body;

  if (!query || typeof query !== "string" || !query.trim()) {
    throw new ApiError(400, "A valid question or search query is required");
  }

  const result = await chatWithMcp({
    query: query.trim(),
    conversationHistory: Array.isArray(history) ? history : [],
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "MCP AI response generated successfully"));
});

/**
 * @desc    Stream AutoBazaar AI response via SSE (MCP tool events + live tokens)
 * @route   POST /api/v1/ai/mcp-chat/stream
 * @access  Public
 */
export const mcpChatStream = async (req, res) => {
  const { query, history = [] } = req.body || {};

  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ success: false, message: "A valid question or search query is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let clientClosed = false;
  res.on("close", () => {
    if (!res.writableEnded) {
      clientClosed = true;
    }
  });

  const sendEvent = (event) => {
    if (clientClosed || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  sendEvent({ type: "status", message: "Connected to AutoBazaar MCP..." });

  try {
    await streamChatWithMcp({
      query: query.trim(),
      conversationHistory: Array.isArray(history) ? history : [],
      onEvent: sendEvent,
    });
  } catch (err) {
    sendEvent({
      type: "error",
      message: err?.message || "MCP streaming error",
    });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
};

/**
 * @desc    List live tools exposed by the AutoBazaar MCP Server
 * @route   GET /api/v1/ai/mcp-tools
 * @access  Public
 */
export const getMcpTools = asyncHandler(async (req, res) => {
  const tools = await listAutobazaarMcpTools();
  return res
    .status(200)
    .json(new ApiResponse(200, { server: "autobazaar-mcp-server", tools }, "MCP tools fetched"));
});

