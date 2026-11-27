import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAutobazaarMcpServer } from "../mcp/autobazaarMcpServer.js";

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MCP_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "autobazaar-advisor";
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "30m";

let mcpClientPromise = null;

/**
 * Get or initialize the singleton in-process MCP Client connected to AutoBazaar MCP Server.
 */
export async function getAutobazaarMcpClient() {
  if (!mcpClientPromise) {
    mcpClientPromise = (async () => {
      const server = createAutobazaarMcpServer();
      const client = new Client(
        { name: "autobazaar-web-client", version: "1.0.0" },
        { capabilities: {} }
      );
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      return client;
    })().catch((err) => {
      mcpClientPromise = null;
      throw err;
    });
  }
  return mcpClientPromise;
}

/**
 * Pre-warm local Ollama model in memory so first user query responds without cold-load delay.
 */
export async function warmUpOllamaModel() {
  try {
    await getAutobazaarMcpClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MCP_CHAT_MODEL,
        messages: [],
        keep_alive: OLLAMA_KEEP_ALIVE,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Non-fatal if Ollama isn't started yet during dev boot
  }
}

function sanitizeParametersForOllama(inputSchema) {
  if (!inputSchema || typeof inputSchema !== "object") {
    return { type: "object", properties: {} };
  }
  const { $schema, additionalProperties, ...rest } = inputSchema;
  return {
    type: "object",
    properties: rest.properties || {},
    ...(Array.isArray(rest.required) && rest.required.length > 0
      ? { required: rest.required }
      : {}),
  };
}

/**
 * List available tools from the AutoBazaar MCP Server.
 */
export async function listAutobazaarMcpTools() {
  const client = await getAutobazaarMcpClient();
  const { tools = [] } = await client.listTools();
  return tools.map((t) => ({
    name: t.name,
    description: t.description || "",
    inputSchema: sanitizeParametersForOllama(t.inputSchema),
  }));
}

function toOllamaTools(mcpTools) {
  return mcpTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/**
 * Non-streaming Ollama call (used for tool-call planning turns).
 */
async function callOllamaChat(messages, tools = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const payload = {
      model: MCP_CHAT_MODEL,
      messages,
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: {
        temperature: 0.25,
        num_ctx: 2048,
        num_predict: 220,
      },
    };
    if (tools.length > 0) {
      payload.tools = tools;
    }

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama /api/chat HTTP ${res.status}: ${errText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Streaming Ollama call — emits text chunks in real time via onToken.
 */
async function streamOllamaChat(messages, onToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MCP_CHAT_MODEL,
        messages,
        stream: true,
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: {
          temperature: 0.25,
          num_ctx: 2048,
          num_predict: 220,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ollama stream HTTP ${res.status}: ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          const token = parsed?.message?.content;
          if (token) {
            fullText += token;
            onToken?.(token);
          }
        } catch {
          // Ignore partial JSON lines
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        const token = parsed?.message?.content;
        if (token) {
          fullText += token;
          onToken?.(token);
        }
      } catch {
        // Ignore trailing non-JSON
      }
    }

    return fullText.trim();
  } finally {
    clearTimeout(timeout);
  }
}

function detectTransmissionConstraint(query) {
  const cleaned = String(query || "").toLowerCase().replace(/autobazaar/gi, "");
  if (/\bauto\w*/i.test(cleaned)) return "automatic";
  if (/\bmanu\w*/i.test(cleaned)) return "manual";
  return null;
}

function looksLikeInventoryQuery(query) {
  const q = String(query || "").toLowerCase();
  return /(car|cars|gaari|gari|vehicle|auto|manual|lac|lakh|crore|budget|price|lahore|karachi|islamabad|inspect|hub|compare|corolla|civic|alto|city|sportage|suzuki|toyota|honda|kia|hybrid|petrol|available|show|find|recommend|suggest|cheapest)/i.test(
    q
  );
}

/**
 * Deterministic Fast-Path Planner:
 * Resolves clear single-intent queries directly to an MCP tool call in ~15ms,
 * skipping the extra LLM tool-selection pass and eliminating small-model arg mistakes.
 */
function planFastMcpCall(query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return null;

  const cities = [
    "lahore",
    "karachi",
    "islamabad",
    "rawalpindi",
    "faisalabad",
    "multan",
    "peshawar",
    "quetta",
    "sialkot",
    "gujranwala",
  ];
  const matchedCity = cities.find((c) => new RegExp(`\\b${c}\\b`, "i").test(q));

  // 1. Inspection hubs query
  if (/\b(hub|hubs|center|centres|centers|branch|branches|address|location)\b/i.test(q) && /inspect/i.test(q)) {
    return {
      name: "get_inspection_hubs",
      arguments: matchedCity ? { city: matchedCity } : {},
    };
  }
  if (/inspection hub/i.test(q)) {
    return {
      name: "get_inspection_hubs",
      arguments: matchedCity ? { city: matchedCity } : {},
    };
  }

  // 2. Inventory summary query
  if (/\b(inventory|summary|overview|all cars|what cars|kitni|how many)\b/i.test(q)) {
    return { name: "get_inventory_summary", arguments: {} };
  }

  // 3. Direct search filters (budget / transmission / city / make / fuel / bodyType)
  const args = {};
  const crMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr)\b/i);
  const lacMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:lac|lakh|lacs)\b/i);
  if (crMatch) {
    args.maxPriceLac = Math.round(parseFloat(crMatch[1]) * 100 * 100) / 100;
  } else if (lacMatch) {
    args.maxPriceLac = parseFloat(lacMatch[1]);
  }

  const tx = detectTransmissionConstraint(q);
  if (tx) args.transmission = tx;
  if (matchedCity) args.city = matchedCity;

  const fuelMatch = q.match(/\b(petrol|diesel|hybrid|electric)\b/i);
  if (fuelMatch) args.fuelType = fuelMatch[1].toLowerCase();

  const bodyMatch = q.match(/\b(sedan|hatchback|suv|crossover)\b/i);
  if (bodyMatch) args.bodyType = bodyMatch[1].toLowerCase();

  const makes = ["toyota", "honda", "suzuki", "kia", "hyundai", "mg", "changan", "nissan"];
  const matchedMake = makes.find((m) => new RegExp(`\\b${m}\\b`, "i").test(q));
  if (matchedMake) args.make = matchedMake;

  const models = ["corolla", "civic", "alto", "city", "sportage", "yaris", "cultus", "wagonr", "vitz", "prius", "aqua"];
  const matchedModel = models.find((m) => new RegExp(`\\b${m}\\b`, "i").test(q));
  if (matchedModel) args.model = matchedModel;

  if (/\b(score\s*9|9\+|certified|high inspection)\b/i.test(q)) {
    args.minInspectionScore = 9;
  }

  if (/\b(cheapest|lowest price|sasti|kam price)\b/i.test(q)) {
    args.sort = "price_asc";
  }

  if (Object.keys(args).length > 0 && !/\b(compare|vs|versus|better|difference)\b/i.test(q)) {
    args.limit = 5;
    return { name: "search_cars", arguments: args };
  }

  return null;
}

function parseToolArgs(rawArgs) {
  let obj = {};
  if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    obj = rawArgs;
  } else if (typeof rawArgs === "string") {
    try {
      const parsed = JSON.parse(rawArgs);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed;
      }
    } catch {
      return {};
    }
  }

  const zeroIgnoreKeys = new Set([
    "minYear",
    "minPricePKR",
    "maxPricePKR",
    "maxPriceLac",
    "minInspectionScore",
    "limit",
  ]);
  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed || /^(null|undefined|none|n\/a)$/i.test(trimmed)) continue;
      if (zeroIgnoreKeys.has(k) && (Number.isNaN(Number(trimmed)) || Number(trimmed) <= 0)) continue;
      cleaned[k] = trimmed;
      continue;
    }
    if (zeroIgnoreKeys.has(k) && (Number.isNaN(Number(v)) || Number(v) <= 0)) continue;
    cleaned[k] = v;
  }
  return cleaned;
}

const COMPACT_RESPONSE_SYSTEM = `You are AutoBazaar AI, Pakistan's verified automotive advisor.
Answer concisely in 2-4 crisp sentences or short bullets using ONLY the verified MCP tool data below.
- Quote prices in PKR Lacs/Crores (e.g. PKR 25 Lac).
- Match the user's language (English or friendly Roman Urdu).
- Never invent cars, never output raw debug labels like CAR #1 or Body Type: N/A, and never print code blocks.`;

const MCP_TOOL_SYSTEM_PROMPT = `You are AutoBazaar AI, Pakistan's verified automotive advisor powered by the AutoBazaar MCP Server.
Rules:
1. Always call AutoBazaar MCP tools before answering about cars, prices, comparisons, or inspection hubs.
2. Only pass filters the user EXPLICITLY asked for; omit unused optional fields.
3. For Lac budgets use maxPriceLac (e.g. "30 lac" -> maxPriceLac: 30).
4. Answer concisely using ONLY cars returned by the MCP tool, with prices in PKR Lac/Crore.`;

/**
 * Stream a conversational turn through AutoBazaar MCP Server + local Ollama.
 * Emits structured progress events for instant UI updates & live token streaming.
 */
export async function streamChatWithMcp({ query, conversationHistory = [], onEvent }) {
  const startedAt = Date.now();
  const emit = (event) => {
    try {
      onEvent?.(event);
    } catch {
      // Ignore callback stream closed errors
    }
  };

  const client = await getAutobazaarMcpClient();
  const sanitizedHistory = conversationHistory
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-4)
    .map((m) => ({ role: m.role, content: m.content }));

  const toolsUsed = [];
  const collectedCarsMap = new Map();

  const runToolCall = async (name, args) => {
    const t0 = Date.now();
    emit({ type: "status", message: `Running MCP tool: ${name}...` });
    const result = await client.callTool({ name, arguments: args });
    const durationMs = Date.now() - t0;

    const textContent = (result?.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const structuredCars = result?.structuredContent?.cars;
    if (Array.isArray(structuredCars)) {
      for (const car of structuredCars) {
        if (car?._id) collectedCarsMap.set(String(car._id), car);
      }
    }

    const toolRecord = {
      name,
      arguments: args,
      isError: Boolean(result?.isError),
      durationMs,
    };
    toolsUsed.push(toolRecord);
    emit({ type: "tool", tool: toolRecord });

    return textContent || "Tool executed with no text output.";
  };

  const getFilteredCars = () => {
    let cars = Array.from(collectedCarsMap.values());
    const tx = detectTransmissionConstraint(query);
    if (tx && cars.length > 0) {
      cars = cars.filter((c) => String(c.transmission || "").toLowerCase() === tx);
    }
    return cars;
  };

  let finalAnswer = "";

  try {
    // FAST PATH: Direct deterministic MCP tool dispatch (~15ms) + single streaming LLM call
    const fastPlan = planFastMcpCall(query);

    if (fastPlan) {
      const toolText = await runToolCall(fastPlan.name, fastPlan.arguments);
      const immediateCars = getFilteredCars();
      if (immediateCars.length > 0) {
        emit({ type: "cars", cars: immediateCars });
      }

      emit({ type: "status", message: "Summarizing verified results..." });
      const promptMessages = [
        { role: "system", content: COMPACT_RESPONSE_SYSTEM },
        ...sanitizedHistory,
        {
          role: "user",
          content: `User question: "${query}"\n\nVerified AutoBazaar MCP Data (${fastPlan.name}):\n${toolText}\n\nAnswer the user directly and naturally in 2-3 short sentences or clean bullet points using ONLY the verified facts above. Never mention "the data" or "here is a reply".`,
        },
      ];

      finalAnswer = await streamOllamaChat(promptMessages, (token) => {
        emit({ type: "token", text: token });
      });
    } else {
      // FULL MCP AGENT LOOP: LLM discovers & selects MCP tools dynamically
      emit({ type: "status", message: "Selecting AutoBazaar MCP tools..." });
      const mcpTools = await listAutobazaarMcpTools();
      const ollamaTools = toOllamaTools(mcpTools);

      const messages = [
        { role: "system", content: MCP_TOOL_SYSTEM_PROMPT },
        ...sanitizedHistory,
        { role: "user", content: query },
      ];

      const MAX_TOOL_TURNS = 3;
      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const response = await callOllamaChat(messages, ollamaTools);
        const assistantMsg = response?.message || {};
        const toolCalls = Array.isArray(assistantMsg.tool_calls) ? assistantMsg.tool_calls : [];

        if (toolCalls.length > 0) {
          messages.push({
            role: "assistant",
            content: assistantMsg.content || "",
            tool_calls: toolCalls,
          });

          for (const tc of toolCalls) {
            const fnName = tc?.function?.name;
            const fnArgs = parseToolArgs(tc?.function?.arguments);
            if (!fnName) continue;

            let toolText = "";
            try {
              toolText = await runToolCall(fnName, fnArgs);
            } catch (err) {
              toolText = `Tool error (${fnName}): ${err.message}`;
            }
            messages.push({ role: "tool", content: toolText });
          }

          const midCars = getFilteredCars();
          if (midCars.length > 0) {
            emit({ type: "cars", cars: midCars });
          }
          continue;
        }

        if (turn === 0 && toolsUsed.length === 0 && looksLikeInventoryQuery(query)) {
          const tx = detectTransmissionConstraint(query);
          const fbTool = tx ? "search_cars" : "get_inventory_summary";
          const fbArgs = tx ? { transmission: tx } : {};
          const toolText = await runToolCall(fbTool, fbArgs);

          const fbCars = getFilteredCars();
          if (fbCars.length > 0) emit({ type: "cars", cars: fbCars });

          emit({ type: "status", message: "Generating grounded response..." });
          finalAnswer = await streamOllamaChat(
            [
              { role: "system", content: COMPACT_RESPONSE_SYSTEM },
              ...sanitizedHistory,
              {
                role: "user",
                content: `User asked: "${query}"\n\nVerified AutoBazaar MCP Data (${fbTool}):\n${toolText}`,
              },
            ],
            (token) => emit({ type: "token", text: token })
          );
          break;
        }

        // Direct answer already returned from Ollama — stream tokens synthetically or emit directly
        finalAnswer = assistantMsg.content?.trim() || "";
        if (finalAnswer) {
          emit({ type: "token", text: finalAnswer });
        }
        break;
      }

      if (toolsUsed.length > 0 && toolsUsed.every((t) => t.isError) && looksLikeInventoryQuery(query)) {
        const summaryText = await runToolCall("get_inventory_summary", {});
        const fbCars = getFilteredCars();
        if (fbCars.length > 0) emit({ type: "cars", cars: fbCars });

        finalAnswer = await streamOllamaChat(
          [
            { role: "system", content: COMPACT_RESPONSE_SYSTEM },
            {
              role: "user",
              content: `User asked: "${query}"\n\nVerified AutoBazaar MCP Inventory:\n${summaryText}`,
            },
          ],
          (token) => emit({ type: "token", text: token })
        );
      } else if (!finalAnswer && toolsUsed.length > 0) {
        emit({ type: "status", message: "Writing response..." });
        finalAnswer = await streamOllamaChat(messages, (token) => emit({ type: "token", text: token }));
      }
    }
  } catch (err) {
    console.error("MCP Chat error:", err?.message || err);
    const errReply =
      "I couldn't reach the local Ollama AI service right now. Please make sure Ollama is running (`http://127.0.0.1:11434`) and try again.";
    emit({ type: "token", text: errReply });
    const donePayload = {
      answer: errReply,
      cars: [],
      toolsUsed,
      mode: "mcp",
      elapsedMs: Date.now() - startedAt,
    };
    emit({ type: "done", ...donePayload });
    return donePayload;
  }

  const returnedCars = getFilteredCars();
  const payload = {
    answer:
      finalAnswer ||
      (returnedCars.length > 0
        ? `I found ${returnedCars.length} verified car(s) matching your request on AutoBazaar.`
        : "I checked the AutoBazaar inventory via MCP, and no matching vehicles are currently listed."),
    cars: returnedCars,
    toolsUsed,
    mode: "mcp",
    elapsedMs: Date.now() - startedAt,
  };

  emit({ type: "done", ...payload });
  return payload;
}

/**
 * Non-streaming wrapper returning complete JSON result.
 */
export async function chatWithMcp({ query, conversationHistory = [] }) {
  return streamChatWithMcp({ query, conversationHistory });
}
