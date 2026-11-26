import api from "./client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

/**
 * Ask AutoBazaar AI Assistant (Legacy Local RAG endpoint)
 * @param {string} query - The buyer question or budget specification
 * @param {Array} history - Previous conversation messages
 */
export async function askAiAdvisor(query, history = []) {
  const response = await api.post("/ai/ask", { query, history });
  return response?.data || response || {};
}

/**
 * Chat with AutoBazaar AI Assistant powered by the AutoBazaar MCP Server
 * @param {string} query - User question in English or Roman Urdu
 * @param {Array} history - Prior conversation turns [{ role, content }]
 */
export async function askMcpChat(query, history = []) {
  const response = await api.post("/ai/mcp-chat", { query, history }, { timeout: 95000 });
  return response?.data || response || {};
}

/**
 * Stream AutoBazaar MCP AI response over Server-Sent Events (SSE)
 * Emits status, tool calls, immediate car cards, live tokens, and done payload.
 */
export async function streamMcpChat(query, history = [], onEvent) {
  const response = await fetch(`${API_BASE}/ai/mcp-chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, history }),
  });

  if (!response.ok || !response.body) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.message || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const event = JSON.parse(jsonStr);
          onEvent?.(event);
        } catch {
          // Ignore malformed chunk
        }
      }
    }
  }
}

/**
 * Fetch registered tools exposed by the AutoBazaar MCP Server
 */
export async function fetchMcpTools() {
  const response = await api.get("/ai/mcp-tools");
  return response?.data || response || {};
}
