import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  chatWithLocalRAG,
  syncAllCarEmbeddings,
  syncCarEmbedding,
} from "../services/localAi.service.js";

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

