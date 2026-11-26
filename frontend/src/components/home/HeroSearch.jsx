import React, { useState } from "react";
import { Link } from "react-router-dom";
import { cities, budgetOptions, bodyTypes } from "../../data/filters";
import { askAiAdvisor } from "../../api/ai.api";

const ENABLE_LOCAL_RAG = false;

function formatPKR(val) {
  if (typeof val !== "number" || isNaN(val)) return "PKR 0";
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

export default function HeroSearch({
  searchQuery,
  onSearchChange,
  selectedCity,
  onCityChange,
  selectedBudget,
  onBudgetChange,
  selectedBodyType,
  onBodyTypeChange,
  onSearchSubmit,
}) {
  const [isSearching, setIsSearching] = useState(false);

  // AI Smart Finder (RAG) State
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiHistory, setAiHistory] = useState([]);
  const [followUpText, setFollowUpText] = useState("");

  const handleSearchClick = () => {
    setIsSearching(true);
    if (onSearchSubmit) {
      onSearchSubmit();
    }
    setTimeout(() => {
      setIsSearching(false);
    }, 500);
  };

  const executeAiSearch = async (queryText) => {
    const q = queryText.trim();
    if (!q) return;

    try {
      setAiLoading(true);
      setAiResponse(null);

      const res = await askAiAdvisor(q, aiHistory);
      const data = res?.data || res || {};

      setAiResponse(data);
      setAiHistory((prev) => [
        ...prev,
        { role: "user", content: q },
        { role: "assistant", content: data.answer || "" },
      ]);
    } catch (err) {
      console.error("AI Search failed:", err);
      setAiResponse({
        answer:
          "I ran into an issue connecting to the local AI service. Please ensure Ollama is active on your machine.",
        cars: [],
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSubmit = (e) => {
    e.preventDefault();
    if (!aiPrompt.trim() || aiLoading) return;
    executeAiSearch(aiPrompt);
  };

  const handlePresetClick = (preset) => {
    setAiPrompt(preset);
    executeAiSearch(preset);
  };

  const handleFollowUpSubmit = (e) => {
    e.preventDefault();
    if (!followUpText.trim() || aiLoading) return;
    const text = followUpText.trim();
    setFollowUpText("");
    executeAiSearch(text);
  };

  return (
    <section className={`relative w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin ${ENABLE_LOCAL_RAG ? "pt-12 md:pt-16" : "pt-12 md:pt-20"} pb-12 flex flex-col items-center text-center`}>
      {/* Subtle Ambient Glow */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-3/4 max-w-3xl h-64 bg-gradient-to-b from-primary-fixed/30 to-transparent blur-3xl pointer-events-none -z-10 rounded-full"></div>

      {/* Live Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container text-primary font-label-md text-label-md mb-space-md border border-outline-variant/30">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
        Verified Automotive Platform • Pakistan
      </div>

      {/* Main H1 Headline */}
      <h1 className="font-display text-display md:text-[44px] md:leading-[52px] font-semibold text-on-surface max-w-3xl tracking-tight mb-space-sm">
        Find your next car in Pakistan
      </h1>

      <p className={`font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed ${ENABLE_LOCAL_RAG ? "mb-6" : "mb-space-xl"}`}>
        Verified used cars with transparent 200-point inspection reports.
      </p>

      {/* ========================================================================= */}
      {/* DEDICATED AI CAR FINDER BAR (OPTION B) - PLACED DIRECTLY ABOVE SEARCH BAR */}
      {/* ========================================================================= */}
      {ENABLE_LOCAL_RAG && (
      <div className="w-full max-w-4xl mb-4 text-left">
        <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-blue-500/40 shadow-[0_4px_25px_rgba(79,70,229,0.12)]">
          <div className="bg-surface-container-lowest dark:bg-[#121826] rounded-[15px] p-2.5 sm:p-3 flex flex-col gap-2.5">
            {/* Header / Sub-badge */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] tracking-wide uppercase border border-indigo-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  ✨ AI Car Finder (Local RAG)
                </span>
                <span className="hidden sm:inline text-xs text-on-surface-variant dark:text-slate-400">
                  Ask in English or Roman Urdu — searches real verified inventory
                </span>
              </div>
            </div>

            {/* Input + Action Button */}
            <form onSubmit={handleAiSubmit} className="flex items-center gap-2">
              <div className="flex-1 flex items-center px-3 py-2 bg-surface-container-low dark:bg-[#1A2132] rounded-xl border border-outline-variant/30 focus-within:border-indigo-500/60 transition-colors">
                <span className="material-symbols-outlined text-indigo-500 text-xl mr-2 select-none">
                  auto_awesome
                </span>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. MY BUDGET IS 30LAC SHOW ME A CAR..."
                  className="w-full bg-transparent font-medium text-sm text-on-surface dark:text-slate-100 placeholder:text-outline focus:outline-none"
                />
                {aiPrompt && (
                  <button
                    type="button"
                    onClick={() => setAiPrompt("")}
                    className="text-on-surface-variant hover:text-on-surface text-xs p-1"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={aiLoading || !aiPrompt.trim()}
                className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:from-[#4338CA] hover:to-[#4F46E5] disabled:opacity-60 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0 active:scale-95"
              >
                {aiLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    <span className="hidden sm:inline">Searching DB...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">psychology</span>
                    <span>Ask AI</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Preset Prompts */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-0.5">
              <span className="text-[11px] font-semibold text-on-surface-variant/70 shrink-0">Try:</span>
              {[
                "MY BUDGET IS 30LAC SHOW ME A CAR",
                "Automatic car in Lahore",
                "High inspection score (9+)",
                "Fuel efficient family car",
              ].map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePresetClick(promptText)}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-surface-container/60 dark:bg-[#1E2638] text-[11px] text-on-surface-variant dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-surface-container transition-colors border border-outline-variant/30"
                >
                  "{promptText}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Shimmer Card */}
        {aiLoading && (
          <div className="mt-3 bg-surface-container-lowest dark:bg-[#121826] rounded-2xl border border-indigo-500/30 p-4 shadow-lg animate-pulse flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500 animate-spin">progress_activity</span>
              <span className="text-xs font-semibold text-on-surface dark:text-slate-200">
                AutoBazaar AI is searching MongoDB and analyzing 200-point inspection ratings...
              </span>
            </div>
            <div className="h-4 bg-surface-container dark:bg-[#1E2638] rounded-md w-3/4"></div>
            <div className="h-4 bg-surface-container dark:bg-[#1E2638] rounded-md w-1/2"></div>
          </div>
        )}

        {/* AI Answer & Matching Vehicle Tray */}
        {aiResponse && !aiLoading && (
          <div className="mt-3 bg-surface-container-lowest dark:bg-[#121826] rounded-2xl border border-indigo-500/30 p-4 sm:p-5 shadow-xl text-left animate-fadeIn">
            {/* Response Header */}
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 dark:border-[#1E2638] mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">smart_toy</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-surface dark:text-[#E6EAF2]">
                    AutoBazaar AI Advisor
                  </h4>
                  <span className="text-[10px] text-on-surface-variant dark:text-slate-400">
                    Grounded in real MongoDB inventory
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiResponse(null)}
                className="text-on-surface-variant hover:text-on-surface text-xs p-1 rounded-md"
                title="Dismiss AI results"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* AI Narrative Reply */}
            <div className="text-xs sm:text-sm text-on-surface dark:text-slate-200 leading-relaxed whitespace-pre-line mb-4 font-normal">
              {aiResponse.answer}
            </div>

            {/* Matching Real Cars from Database */}
            {Array.isArray(aiResponse.cars) && aiResponse.cars.length > 0 && (
              <div className="mt-3 pt-3 border-t border-outline-variant/30 dark:border-[#1E2638]">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-400">
                    Verified Cars Found ({aiResponse.cars.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {aiResponse.cars.map((car) => {
                    const rawImg =
                      Array.isArray(car.images) && car.images.length > 0
                        ? car.images[0]
                        : null;
                    const thumbnail = rawImg
                      ? rawImg.startsWith("http")
                        ? rawImg
                        : `http://localhost:5000${rawImg}`
                      : "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80";

                    return (
                      <div
                        key={car._id}
                        className="rounded-xl bg-surface-container-low dark:bg-[#1A2132] border border-outline-variant/30 dark:border-[#2A3449] overflow-hidden flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-sm"
                      >
                        <div className="relative aspect-[16/10] bg-surface-container overflow-hidden">
                          <img
                            src={thumbnail}
                            alt={car.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80";
                            }}
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white font-bold text-[10px]">
                            {formatPKR(car.price)}
                          </span>
                          {car.inspectionScore && (
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600/90 backdrop-blur-sm text-white font-bold text-[10px] flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">verified</span>
                              {car.inspectionScore}/10
                            </span>
                          )}
                        </div>

                        <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between">
                          <div>
                            <h5 className="font-bold text-xs text-on-surface dark:text-slate-100 line-clamp-1">
                              {car.title}
                            </h5>
                            <p className="text-[11px] text-on-surface-variant dark:text-slate-400">
                              {car.city || "Pakistan"} • {car.year} • {car.transmission || "Auto"}
                            </p>
                          </div>

                          <Link
                            to={`/cars/${car._id}`}
                            className="mt-2 w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs text-center transition-colors flex items-center justify-center gap-1"
                          >
                            <span>View Listing</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Follow-up Query Bar */}
            <form onSubmit={handleFollowUpSubmit} className="mt-4 pt-3 border-t border-outline-variant/30 dark:border-[#1E2638] flex items-center gap-2">
              <input
                type="text"
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                placeholder="Ask follow-up (e.g. Which one has better fuel average?)..."
                className="flex-1 px-3 py-1.5 bg-surface-container-low dark:bg-[#1A2132] rounded-xl text-xs text-on-surface dark:text-slate-100 placeholder:text-outline border border-outline-variant/30 focus:outline-none focus:border-indigo-500/60"
              />
              <button
                type="submit"
                disabled={aiLoading || !followUpText.trim()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* EXISTING TRADITIONAL ELEVATED SEARCH COMPONENT                            */}
      {/* ========================================================================= */}
      <div className="w-full max-w-4xl bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-2 md:p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 border border-outline-variant/40">
        {/* Input 1: Make / Model */}
        <div className="flex-1 flex items-center px-3.5 py-2.5 bg-surface-container-low md:bg-transparent rounded-xl">
          <span className="material-symbols-outlined text-outline text-xl mr-2.5 select-none">
            directions_car
          </span>
          <div className="flex flex-col text-left w-full min-w-0">
            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="car-query">
              Make & Model
            </label>
            <input
              id="car-query"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="e.g. Honda Civic, Sportage..."
              className="w-full bg-transparent font-medium text-sm text-on-surface placeholder:text-outline focus:outline-none truncate"
            />
          </div>
        </div>

        {/* Segment Divider 1 */}
        <div className="hidden md:block w-px h-10 bg-outline-variant/30"></div>

        {/* Input 2: City Selector */}
        <div className="flex-1 flex items-center px-3.5 py-2.5 bg-surface-container-low md:bg-transparent rounded-xl">
          <span className="material-symbols-outlined text-outline text-xl mr-2.5 select-none">
            location_on
          </span>
          <div className="flex flex-col text-left w-full min-w-0">
            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="city-select">
              City
            </label>
            <select
              id="city-select"
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="w-full bg-transparent font-medium text-sm text-on-surface focus:outline-none cursor-pointer truncate pr-2"
            >
              {cities.map((city) => (
                <option key={city.value} value={city.value}>
                  {city.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Segment Divider 2 */}
        <div className="hidden md:block w-px h-10 bg-outline-variant/30"></div>

        {/* Input 3: Budget */}
        <div className="flex-1 flex items-center px-3.5 py-2.5 bg-surface-container-low md:bg-transparent rounded-xl">
          <span className="material-symbols-outlined text-outline text-xl mr-2.5 select-none">
            payments
          </span>
          <div className="flex flex-col text-left w-full min-w-0">
            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="budget-select">
              Price Range
            </label>
            <select
              id="budget-select"
              value={selectedBudget}
              onChange={(e) => onBudgetChange(e.target.value)}
              className="w-full bg-transparent font-medium text-sm text-on-surface focus:outline-none cursor-pointer truncate pr-2"
            >
              {budgetOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          id="search-trigger-btn"
          type="button"
          onClick={handleSearchClick}
          className="h-12 md:h-12 px-6 rounded-xl bg-primary hover:opacity-95 text-on-primary font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shrink-0 mt-1 md:mt-0 active:scale-95"
        >
          {isSearching ? (
            <>
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">search</span>
              <span>Search Cars</span>
            </>
          )}
        </button>
      </div>

      {/* Body-Type Filter Chips */}
      <div className="w-full max-w-4xl mt-6 flex items-center justify-start md:justify-center gap-2.5 overflow-x-auto no-scrollbar py-1">
        {bodyTypes.map((type) => {
          const isActive = selectedBodyType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onBodyTypeChange(type.id)}
              className={`shrink-0 px-5 py-2 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/40"
              }`}
            >
              {type.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
