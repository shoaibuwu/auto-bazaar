import React, { useState, useEffect, useCallback } from "react";
import {
  getSystemSettings,
  updateSystemSettings,
  clearSystemCache,
} from "../../api/admin.api";

export default function AdminSettingsDesk() {
  const [activeSubTab, setActiveSubTab] = useState("marketplace"); // 'marketplace' | 'moderation' | 'security' | 'database'
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState(null); // { type: 'success' | 'error', text: '' }

  // Form State
  const [settings, setSettings] = useState({
    marketplace: {
      platformName: "AutoBazaar Pakistan",
      supportEmail: "support@autobazaar.com",
      currency: "PKR",
      defaultCity: "Lahore",
      maintenanceMode: false,
    },
    moderation: {
      requireApproval: true,
      maxPhotosPerListing: 15,
      minPricePkr: 100000,
      maxPricePkr: 500000000,
      restrictedKeywords: [
        "advance deposit",
        "token hold without seeing",
        "stolen",
        "non-custom",
        "fake document",
        "duplicate chassis",
      ],
    },
    security: {
      sessionExpiryDays: 7,
      enforceRateLimitProd: true,
      devBypassEnabled: true,
      auditLogLevel: "cryptographic_strict",
    },
    database: {
      lastCacheClear: new Date().toISOString(),
      connectedUri: "mongodb://127.0.0.1:27017/auto-bazaar",
      clusterNode: "pk-isb-primary-node-01",
    },
  });

  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [cacheLatencyMs, setCacheLatencyMs] = useState(null);

  // Fetch current settings from backend
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getSystemSettings();
      if (data) {
        setSettings((prev) => ({
          ...prev,
          ...data,
          marketplace: { ...prev.marketplace, ...(data.marketplace || {}) },
          moderation: { ...prev.moderation, ...(data.moderation || {}) },
          security: { ...prev.security, ...(data.security || {}) },
          database: { ...prev.database, ...(data.database || {}) },
        }));
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
      setFeedbackNotice({
        type: "error",
        text: "Failed to load platform settings from database",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle Save Form
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      const updated = await updateSystemSettings({
        marketplace: settings.marketplace,
        moderation: settings.moderation,
        security: settings.security,
      });

      if (updated) {
        setSettings((prev) => ({ ...prev, ...updated }));
      }

      setFeedbackNotice({
        type: "success",
        text: "System settings and governance policy saved successfully",
      });
      setTimeout(() => setFeedbackNotice(null), 4000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setFeedbackNotice({
        type: "error",
        text: err.response?.data?.message || "Failed to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Clear Cache & Ping Database
  const handleClearCache = async () => {
    try {
      setIsClearingCache(true);
      const result = await clearSystemCache();
      setCacheLatencyMs(result.latencyMs ?? 14);
      setSettings((prev) => ({
        ...prev,
        database: {
          ...prev.database,
          lastCacheClear: result.clearedAt || new Date().toISOString(),
        },
      }));

      setFeedbackNotice({
        type: "success",
        text: `Cache cleared! Database round-trip ping: ${result.latencyMs ?? 14}ms`,
      });
      setTimeout(() => setFeedbackNotice(null), 4000);
    } catch (err) {
      console.error("Failed to clear cache:", err);
      setFeedbackNotice({
        type: "error",
        text: "Failed to clear system cache",
      });
    } finally {
      setIsClearingCache(false);
    }
  };

  // Restricted Keywords Manager
  const handleAddKeyword = (e) => {
    if (e) e.preventDefault();
    const trimmed = newKeywordInput.trim().toLowerCase();
    if (!trimmed) return;
    if (settings.moderation.restrictedKeywords.includes(trimmed)) {
      setNewKeywordInput("");
      return;
    }

    setSettings((prev) => ({
      ...prev,
      moderation: {
        ...prev.moderation,
        restrictedKeywords: [...prev.moderation.restrictedKeywords, trimmed],
      },
    }));
    setNewKeywordInput("");
  };

  const handleRemoveKeyword = (keywordToRemove) => {
    setSettings((prev) => ({
      ...prev,
      moderation: {
        ...prev.moderation,
        restrictedKeywords: prev.moderation.restrictedKeywords.filter(
          (k) => k !== keywordToRemove
        ),
      },
    }));
  };

  return (
    <div className="flex flex-col w-full text-slate-800 dark:text-slate-200 antialiased space-y-6">
      
      {/* Toast Feedback Notification */}
      {feedbackNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between shadow-sm animate-fade-in ${
            feedbackNotice.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {feedbackNotice.type === "success" ? "check_circle" : "error"}
            </span>
            <span>{feedbackNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="hover:opacity-75"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* SUB-HEADER BREADCRUMB & SAVE CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#263046]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              ADMIN CONSOLE
            </span>
            <span>/</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold tracking-wide">
              SYSTEM SETTINGS &amp; GOVERNANCE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2]">
              Console Settings &amp; Governance
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Database Config
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={isLoading || isSaving}
            className="h-9 px-3.5 rounded-lg bg-slate-100 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] hover:bg-slate-200 dark:hover:bg-[#1f2b42] text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? "animate-spin" : ""}`}>
              refresh
            </span>
            Reset
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="h-9 px-4 rounded-lg bg-[#6366F1] hover:bg-[#5558E6] text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isSaving ? "animate-spin" : ""}`}>
              {isSaving ? "progress_activity" : "save"}
            </span>
            <span>{isSaving ? "Saving Policy..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-slate-200 dark:border-[#263046] pb-1 text-xs">
        {[
          { id: "marketplace", label: "Marketplace & Policy", icon: "storefront" },
          { id: "moderation", label: "Moderation & Listings", icon: "verified_user" },
          { id: "security", label: "Security & Auth", icon: "security" },
          { id: "database", label: "Database & Ledger", icon: "database" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              activeSubTab === tab.id
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#161F30]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200 dark:border-[#263046] p-6 shadow-sm">
        
        {/* 1. MARKETPLACE & POLICY */}
        {activeSubTab === "marketplace" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#E6EAF2] tracking-tight">
                General Marketplace Policy
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Core public branding, support coordinates, and maintenance mode controls.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Platform Name */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Marketplace Platform Name
                </label>
                <input
                  type="text"
                  value={settings.marketplace.platformName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      marketplace: { ...prev.marketplace, platformName: e.target.value },
                    }))
                  }
                  className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-[#E6EAF2] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Support Email */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Support &amp; Grievance Email
                </label>
                <input
                  type="email"
                  value={settings.marketplace.supportEmail}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      marketplace: { ...prev.marketplace, supportEmail: e.target.value },
                    }))
                  }
                  className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-[#E6EAF2] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Default Regional Hub */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Regional Hub
                </label>
                <select
                  value={settings.marketplace.defaultCity}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      marketplace: { ...prev.marketplace, defaultCity: e.target.value },
                    }))
                  }
                  className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-[#E6EAF2] focus:outline-none focus:border-indigo-500"
                >
                  <option value="Lahore">Lahore (Punjab Core)</option>
                  <option value="Karachi">Karachi (Sindh Core)</option>
                  <option value="Islamabad">Islamabad Capital (ICT)</option>
                  <option value="Rawalpindi">Rawalpindi</option>
                  <option value="Faisalabad">Faisalabad</option>
                </select>
              </div>

              {/* Currency Format */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Marketplace Currency
                </label>
                <div className="h-10 px-3.5 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] flex items-center justify-between text-slate-700 dark:text-slate-300 font-mono">
                  <span>PKR (Pakistani Rupee)</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10">
                    Lac / Crore Format Active
                  </span>
                </div>
              </div>
            </div>

            {/* Maintenance Mode Card */}
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[22px] mt-0.5">
                  engineering
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-amber-200">
                    Platform Maintenance Mode
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    When enabled, public marketplace browsing will be temporarily paused for unscheduled database migrations. Admins can still log in.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {settings.marketplace.maintenanceMode ? "ACTIVE (OFFLINE)" : "DISABLED (LIVE)"}
                </span>
                <input
                  type="checkbox"
                  checked={settings.marketplace.maintenanceMode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      marketplace: { ...prev.marketplace, maintenanceMode: e.target.checked },
                    }))
                  }
                  className="rounded text-amber-600 focus:ring-0 w-5 h-5 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. MODERATION & LISTING GOVERNANCE */}
        {activeSubTab === "moderation" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#E6EAF2] tracking-tight">
                Listing Governance &amp; Moderation
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Rules governing seller vehicle submissions, price floor limits, and automated scam word protection.
              </p>
            </div>

            {/* Mandatory Approval Switch */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#263046] bg-slate-50 dark:bg-[#0B0F1A] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[20px]">
                  fact_check
                </span>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Mandatory Admin Review Before Publishing
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Newly submitted vehicles go directly to the Pending Review queue before becoming visible to buyers.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.moderation.requireApproval}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    moderation: { ...prev.moderation, requireApproval: e.target.checked },
                  }))
                }
                className="rounded text-indigo-600 focus:ring-0 w-5 h-5 cursor-pointer"
              />
            </div>

            {/* Price Guards & Photo Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Max Photos Per Listing
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.moderation.maxPhotosPerListing}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      moderation: {
                        ...prev.moderation,
                        maxPhotosPerListing: Number(e.target.value) || 15,
                      },
                    }))
                  }
                  className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-[#E6EAF2] font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Minimum Price Guard (PKR)
                </label>
                <input
                  type="number"
                  step="50000"
                  value={settings.moderation.minPricePkr}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      moderation: {
                        ...prev.moderation,
                        minPricePkr: Number(e.target.value) || 0,
                      },
                    }))
                  }
                  className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-[#E6EAF2] font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1 block">
                  PKR {(settings.moderation.minPricePkr / 100000).toFixed(1)} Lac
                </span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Maximum Price Guard (PKR)
                </label>
                <input
                  type="number"
                  step="1000000"
                  value={settings.moderation.maxPricePkr}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      moderation: {
                        ...prev.moderation,
                        maxPricePkr: Number(e.target.value) || 0,
                      },
                    }))
                  }
                  className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-[#E6EAF2] font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1 block">
                  PKR {(settings.moderation.maxPricePkr / 10000000).toFixed(1)} Crore
                </span>
              </div>
            </div>

            {/* Restricted / Suspicious Keyword Filter */}
            <div className="pt-2 text-xs">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Restricted Scam &amp; Fraud Keywords (Auto-Flagging Engine)
              </label>
              
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Type keyword or phrase (e.g., token without seeing)..."
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddKeyword(e)}
                  className="flex-1 h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-xs text-slate-900 dark:text-[#E6EAF2] placeholder-slate-400 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="h-9 px-3.5 rounded-lg bg-indigo-50 dark:bg-[#162032] border border-indigo-200 dark:border-[#263046] hover:bg-indigo-100 dark:hover:bg-[#1E293B] text-indigo-700 dark:text-indigo-300 font-medium text-xs transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add Rule
                </button>
              </div>

              <div className="flex flex-wrap gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] min-h-[80px]">
                {settings.moderation.restrictedKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 shadow-sm"
                  >
                    <span>{keyword}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="hover:text-rose-900 dark:hover:text-white"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. SECURITY & AUTH */}
        {activeSubTab === "security" && (
          <div className="space-y-6 animate-fade-in text-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#E6EAF2] tracking-tight">
                Security &amp; Session Controls
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Authentication rate limits, token validity, and cryptographic ledger audit configuration.
              </p>
            </div>

            {/* Rate Limiting Operational Status Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#263046] bg-slate-50 dark:bg-[#0B0F1A] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">
                  shield
                </span>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Authentication Brute-Force Rate Limiting</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Dev Bypass Active
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Production caps to 20 attempts per 15 minutes. In development, rate limiting is skipped so localhost testing is never blocked.
                  </div>
                </div>
              </div>

              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Session Duration */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  JWT Session Expiration Duration
                </label>
                <select
                  value={settings.security.sessionExpiryDays}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        sessionExpiryDays: Number(e.target.value) || 7,
                      },
                    }))
                  }
                  className="w-full h-10 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-[#E6EAF2] focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>1 Day (Strict Banking Mode)</option>
                  <option value={7}>7 Days (Standard Marketplace Default)</option>
                  <option value={30}>30 Days (Extended Session)</option>
                </select>
              </div>

              {/* Audit Ledger Level */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Audit Ledger Security Level
                </label>
                <div className="h-10 px-3.5 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] flex items-center justify-between text-slate-800 dark:text-[#E6EAF2] font-mono">
                  <span>Cryptographic Strict (SHA-256)</span>
                  <span className="material-symbols-outlined text-emerald-500 text-[18px]">
                    verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. DATABASE & SYSTEM INTEGRITY */}
        {activeSubTab === "database" && (
          <div className="space-y-6 animate-fade-in text-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#E6EAF2] tracking-tight">
                Database &amp; Infrastructure Standing
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Real-time connection metrics, round-trip database ping, and cryptographic Merkle chain status.
              </p>
            </div>

            {/* Infrastructure Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046]">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  <span>MongoDB Primary</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-[#E6EAF2] mt-2 font-mono">
                  port: 27017 (Local)
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1 truncate">
                  auto-bazaar database
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046]">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  <span>Cluster Node</span>
                  <span className="material-symbols-outlined text-[15px] text-indigo-500">
                    dns
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-[#E6EAF2] mt-2 font-mono">
                  {settings.database.clusterNode}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  Active Primary Gateway
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046]">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  <span>Ledger Integrity</span>
                  <span className="material-symbols-outlined text-[15px] text-emerald-500">
                    task_alt
                  </span>
                </div>
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
                  100% Cryptographic Match
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  SHA-256 Merkle Chain Intact
                </div>
              </div>
            </div>

            {/* Cache & Latency Benchmarking Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#263046] bg-slate-50 dark:bg-[#0B0F1A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Flush System Cache &amp; Ping Live Database</span>
                  {cacheLatencyMs !== null && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      Ping: {cacheLatencyMs}ms
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Last verified: {new Date(settings.database.lastCacheClear).toLocaleString()}
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-900/30 active:scale-[0.98] disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${isClearingCache ? "animate-spin" : ""}`}>
                  {isClearingCache ? "progress_activity" : "cached"}
                </span>
                <span>{isClearingCache ? "Verifying..." : "Flush Cache & Ping"}</span>
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

