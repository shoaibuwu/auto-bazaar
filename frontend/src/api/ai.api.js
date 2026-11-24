import api from "./client";

/**
 * Ask AutoBazaar AI Assistant (Local RAG)
 * @param {string} query - The buyer question or budget specification
 * @param {Array} history - Previous conversation messages
 */
export async function askAiAdvisor(query, history = []) {
  const response = await api.post("/ai/ask", { query, history });
  return response?.data || response || {};
}

