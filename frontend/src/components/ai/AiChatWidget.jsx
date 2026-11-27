import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { streamMcpChat, askMcpChat, fetchMcpTools } from "../../api/ai.api";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(
  /\/api\/v1\/?$/,
  ""
);

const FALLBACK_CAR_IMAGE =
  "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80";

const QUICK_PROMPTS = [
  { icon: "directions_car", text: "Automatic car available?" },
  { icon: "payments", text: "My budget is 30 Lac, show cars" },
  { icon: "verified_user", text: "Inspection hubs in Pakistan?" },
  { icon: "inventory_2", text: "Show inventory summary" },
];

function formatPKR(val) {
  if (typeof val !== "number" || Number.isNaN(val)) return "PKR 0";
  if (val >= 10000000) {
    const cr = (val / 10000000).toFixed(2);
    return `PKR ${cr.endsWith(".00") ? cr.slice(0, -3) : cr} Crore`;
  }
  if (val >= 100000) {
    const lac = (val / 100000).toFixed(2);
    return `PKR ${lac.endsWith(".00") ? lac.slice(0, -3) : lac} Lac`;
  }
  return `PKR ${val.toLocaleString()}`;
}

function resolveCarImage(images) {
  const raw = Array.isArray(images) && images.length > 0 ? images[0] : null;
  if (!raw) return FALLBACK_CAR_IMAGE;
  return raw.startsWith("http") ? raw : `${API_ORIGIN}${raw}`;
}

/**
 * Lightweight markdown renderer supporting bullet lists (* / -), **bold**, and `code` spans.
 */
function FormattedInline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={idx} className="font-semibold text-on-surface dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={idx}
              className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
}

function FormattedMessage({ text }) {
  if (!text) return null;
  const lines = String(text).split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const bulletMatch = line.match(/^\s*[*\-•]\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span className="flex-1">
                <FormattedInline text={bulletMatch[1]} />
              </span>
            </div>
          );
        }
        if (!line.trim()) {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="leading-relaxed">
            <FormattedInline text={line} />
          </p>
        );
      })}
    </div>
  );
}

export default function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [mcpTools, setMcpTools] = useState([]);
  const [showToolsPanel, setShowToolsPanel] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    if (mcpTools.length === 0) {
      fetchMcpTools()
        .then((res) => {
          const tools = res?.tools || res?.data?.tools || [];
          if (Array.isArray(tools)) setMcpTools(tools);
        })
        .catch(() => {});
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, mcpTools.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text) => {
    const q = text.trim();
    if (!q || isLoading) return;

    const historyForApi = messages
      .filter((m) => m.content)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const assistantMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        statusText: "Connecting to AutoBazaar MCP...",
        cars: [],
        toolsUsed: [],
        isStreaming: true,
        elapsedMs: null,
      },
    ]);
    setInput("");
    setIsLoading(true);

    const updateAssistant = (updater) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? updater(m) : m))
      );
    };

    try {
      await streamMcpChat(q, historyForApi, (event) => {
        if (event.type === "status") {
          updateAssistant((m) => ({ ...m, statusText: event.message }));
        } else if (event.type === "tool" && event.tool) {
          updateAssistant((m) => ({
            ...m,
            toolsUsed: [...(m.toolsUsed || []), event.tool],
          }));
        } else if (event.type === "cars" && Array.isArray(event.cars)) {
          updateAssistant((m) => ({
            ...m,
            cars: event.cars,
          }));
        } else if (event.type === "token" && event.text) {
          updateAssistant((m) => ({
            ...m,
            statusText: "",
            content: (m.content || "") + event.text,
          }));
        } else if (event.type === "done") {
          updateAssistant((m) => ({
            ...m,
            content: event.answer || m.content,
            cars: Array.isArray(event.cars) ? event.cars : m.cars,
            toolsUsed: Array.isArray(event.toolsUsed) ? event.toolsUsed : m.toolsUsed,
            elapsedMs: event.elapsedMs ?? null,
            statusText: "",
            isStreaming: false,
          }));
        } else if (event.type === "error") {
          updateAssistant((m) => ({
            ...m,
            content: event.message || "Streaming error occurred.",
            statusText: "",
            isStreaming: false,
          }));
        }
      });

      // Ensure streaming flag clears if SSE closes without explicit done
      updateAssistant((m) => (m.isStreaming ? { ...m, isStreaming: false, statusText: "" } : m));
    } catch {
      // Fallback to standard JSON endpoint if SSE is unavailable
      try {
        const data = await askMcpChat(q, historyForApi);
        updateAssistant((m) => ({
          ...m,
          content:
            data?.answer ||
            "I checked AutoBazaar's live MCP server, please try rephrasing your query.",
          cars: Array.isArray(data?.cars) ? data.cars : [],
          toolsUsed: Array.isArray(data?.toolsUsed) ? data.toolsUsed : [],
          elapsedMs: data?.elapsedMs ?? null,
          statusText: "",
          isStreaming: false,
        }));
      } catch (err) {
        updateAssistant((m) => ({
          ...m,
          content:
            err?.message ||
            "Could not reach the AutoBazaar MCP AI service. Please ensure the backend and local Ollama are running.",
          cars: [],
          toolsUsed: [],
          statusText: "",
          isStreaming: false,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end">
      {/* Chat Drawer */}
      {isOpen && (
        <div
          className={`mb-3 rounded-2xl bg-surface-container-lowest/95 dark:bg-[#0F1624]/95 backdrop-blur-xl border border-indigo-500/25 dark:border-indigo-400/20 shadow-[0_20px_60px_rgba(15,23,42,0.28)] flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded
              ? "w-[calc(100vw-2rem)] sm:w-[560px] h-[640px] max-h-[82vh]"
              : "w-[calc(100vw-2rem)] sm:w-[430px] h-[560px] max-h-[76vh]"
          }`}
        >
          {/* Cockpit Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#4338CA] via-[#4F46E5] to-[#6366F1] text-white flex items-center justify-between gap-2 shrink-0 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2.5 min-w-0 relative z-10">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner shrink-0">
                <span className="material-symbols-outlined text-xl">bolt</span>
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold tracking-tight truncate">AutoBazaar AI</h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-400/20 border border-emerald-300/30 text-emerald-100 text-[9px] font-bold uppercase tracking-wider shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    MCP Fast
                  </span>
                </div>
                <p className="text-[11px] text-indigo-100/90 leading-tight truncate">
                  Live MongoDB • Streaming
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 relative z-10">
              {mcpTools.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowToolsPanel((v) => !v)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors border ${
                    showToolsPanel
                      ? "bg-white text-indigo-700 border-white"
                      : "bg-white/15 hover:bg-white/25 text-white border-white/15"
                  }`}
                  title="Inspect registered MCP tools"
                >
                  <span className="material-symbols-outlined text-[13px]">build</span>
                  <span>{mcpTools.length}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="hidden sm:inline-flex p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                title={isExpanded ? "Compact view" : "Expand chat"}
              >
                <span className="material-symbols-outlined text-base">
                  {isExpanded ? "close_fullscreen" : "open_in_full"}
                </span>
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                  title="Clear conversation"
                >
                  <span className="material-symbols-outlined text-base">delete_sweep</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                title="Close chat (Esc)"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          {/* Live MCP Tools Inspector */}
          {showToolsPanel && mcpTools.length > 0 && (
            <div className="px-3.5 py-2.5 bg-indigo-50/70 dark:bg-[#172033] border-b border-indigo-500/15 max-h-40 overflow-y-auto shrink-0 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">dns</span>
                AutoBazaar MCP Server Tools ({mcpTools.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {mcpTools.map((tool) => (
                  <span
                    key={tool.name}
                    title={tool.description}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-[#0F1624] text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-mono shadow-xs"
                  >
                    {tool.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Feed */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5 text-left">
            {messages.length === 0 && (
              <div className="py-3 px-1 flex flex-col items-center text-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/25 text-indigo-500 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-2xl">hub</span>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0F1624] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[10px] text-white">bolt</span>
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-on-surface dark:text-slate-100">
                    Fast MCP Car Advisor
                  </h4>
                  <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-1 leading-relaxed max-w-xs">
                    Instant live MongoDB car search, 200-point inspection checks &amp; PKR Lac budgets in English or Roman Urdu.
                  </p>
                </div>

                <div className="w-full grid grid-cols-1 gap-1.5 mt-1">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item.text}
                      type="button"
                      onClick={() => sendMessage(item.text)}
                      className="group w-full text-left px-3 py-2.5 rounded-xl bg-surface-container-low dark:bg-[#172033] hover:bg-indigo-500/10 dark:hover:bg-indigo-500/15 border border-outline-variant/30 dark:border-[#26324B] hover:border-indigo-500/40 text-xs font-medium text-on-surface dark:text-slate-200 transition-all flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-indigo-500">
                          {item.icon}
                        </span>
                        <span>{item.text}</span>
                      </span>
                      <span className="material-symbols-outlined text-sm text-indigo-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                        arrow_forward
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                {/* Tool Execution Pills (shown immediately above assistant output as soon as MCP returns) */}
                {msg.role === "assistant" &&
                  ((Array.isArray(msg.toolsUsed) && msg.toolsUsed.length > 0) || msg.statusText) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      {msg.toolsUsed?.map((t, i) => (
                        <span
                          key={`${t.name}-${i}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-mono"
                        >
                          <span className="material-symbols-outlined text-[11px]">check_circle</span>
                          <span>{t.name}</span>
                          {typeof t.durationMs === "number" && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {t.durationMs}ms
                            </span>
                          )}
                        </span>
                      ))}
                      {msg.statusText && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 text-[10px]">
                          <span className="material-symbols-outlined animate-spin text-[11px]">
                            progress_activity
                          </span>
                          <span>{msg.statusText}</span>
                        </span>
                      )}
                    </div>
                  )}

                {/* Instant Grounded Vehicle Cards (rendered BEFORE LLM text finishes!) */}
                {msg.role === "assistant" && Array.isArray(msg.cars) && msg.cars.length > 0 && (
                  <div className="w-full mb-2 grid grid-cols-1 gap-2">
                    {msg.cars.map((car) => (
                      <div
                        key={car._id}
                        className="group rounded-xl bg-surface-container-lowest dark:bg-[#161F31] border border-outline-variant/35 dark:border-[#28354E] hover:border-indigo-500/50 p-2.5 flex items-center gap-3 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="relative w-24 h-[68px] rounded-lg overflow-hidden shrink-0 bg-surface-container">
                          <img
                            src={resolveCarImage(car.images)}
                            alt={car.title}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = FALLBACK_CAR_IMAGE;
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {car.inspectionScore && (
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-bold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[10px]">verified</span>
                              {car.inspectionScore}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-xs text-on-surface dark:text-slate-100 truncate">
                            {car.title}
                          </h5>
                          <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {formatPKR(car.price)}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-[10px] text-on-surface-variant dark:text-slate-400">
                            <span className="whitespace-nowrap">{car.city || "Pakistan"}</span>
                            <span aria-hidden="true">•</span>
                            <span className="whitespace-nowrap">{car.year}</span>
                            <span aria-hidden="true">•</span>
                            <span className="capitalize whitespace-nowrap">{car.transmission}</span>
                            {typeof car.mileage === "number" && (
                              <span className="whitespace-nowrap">
                                • {car.mileage.toLocaleString()} km
                              </span>
                            )}
                          </div>
                        </div>

                        <Link
                          to={`/cars/${car._id}`}
                          onClick={() => setIsOpen(false)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold shrink-0 flex items-center gap-0.5 shadow-sm transition-colors"
                        >
                          <span>View</span>
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chat Bubble */}
                {(msg.content || msg.role === "user") && (
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "whitespace-pre-line bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white rounded-br-sm shadow-sm"
                        : "bg-surface-container-low dark:bg-[#172033] text-on-surface dark:text-slate-100 border border-outline-variant/30 dark:border-[#26324B] rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "user" ? (
                      msg.content
                    ) : (
                      <>
                        <FormattedMessage text={msg.content} />
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-indigo-500 animate-pulse rounded-xs" />
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Response Latency Footer */}
                {msg.role === "assistant" && !msg.isStreaming && typeof msg.elapsedMs === "number" && (
                  <span className="mt-1 px-1 text-[10px] text-on-surface-variant/70 dark:text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px] text-emerald-500">
                      bolt
                    </span>
                    Answered in {(msg.elapsedMs / 1000).toFixed(1)}s via local MCP
                  </span>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-outline-variant/30 dark:border-[#26324B] bg-surface-container-lowest dark:bg-[#0F1624] flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              id="mcp-chat-input"
              name="mcpQuery"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in English or Roman Urdu (e.g. 30 lac auto car)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-container-low dark:bg-[#172033] border border-outline-variant/30 dark:border-[#26324B] text-xs text-on-surface dark:text-slate-100 placeholder:text-outline focus:outline-none focus:border-indigo-500/70 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:from-[#4338CA] hover:to-[#4F46E5] disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1 transition-all shadow-sm active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-base">
                {isLoading ? "progress_activity" : "send"}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* Sleek Floating Launcher Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="group relative h-12 px-4 rounded-full bg-gradient-to-r from-[#4338CA] via-[#4F46E5] to-[#6366F1] hover:from-[#3730A3] hover:to-[#4F46E5] text-white shadow-[0_10px_30px_rgba(79,70,229,0.4)] flex items-center gap-2 font-semibold text-xs sm:text-sm transition-all hover:-translate-y-0.5 active:scale-95"
        aria-label="Open AutoBazaar MCP AI Chat"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
        </span>
        <span className="material-symbols-outlined text-xl">
          {isOpen ? "close" : "smart_toy"}
        </span>
        <span>{isOpen ? "Close AI" : "Ask AI • MCP"}</span>
      </button>
    </div>
  );
}

