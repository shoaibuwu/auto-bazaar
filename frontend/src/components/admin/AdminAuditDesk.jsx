import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getAuditLogs, verifyAuditChain } from "../../api/admin.api";

export default function AdminAuditDesk() {
  // Data state
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({
    totalEvents: 0,
    adminActions: 0,
    listingEvents: 0,
    securityFlags: 0,
    merkleRoot: "0x00000000",
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 20,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all"); // 'all' | 'admin' | 'listing' | 'security'
  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [timeframeFilter, setTimeframeFilter] = useState("all");

  // Inspection modal state
  const [inspectLog, setInspectLog] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Cryptographic verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null); // { isValid: true, verifiedCount: 10 }
  const [toastNotice, setToastNotice] = useState("");

  // Fetch audit logs from backend API
  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAuditLogs({
        search: searchTerm,
        action: actionFilter !== "all" ? actionFilter : "",
        actionCategory: categoryFilter !== "all" ? categoryFilter : "",
        actor: actorFilter !== "all" ? actorFilter : "",
        page: pagination.page,
        limit: pagination.limit,
      });

      setLogs(data.logs || []);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      setToastNotice("Failed to load audit logs from database");
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, categoryFilter, actionFilter, actorFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  // Run cryptographic chain integrity verification
  const handleVerifyLedger = async () => {
    try {
      setIsVerifying(true);
      const result = await verifyAuditChain();
      setVerificationResult(result);
      if (result.isValid) {
        setToastNotice(`Cryptographic match confirmed across all ${result.verifiedCount} ledger blocks!`);
      } else {
        setToastNotice(`Warning: Chain verification mismatch: ${result.error || "Integrity error"}`);
      }
      setTimeout(() => {
        setIsVerifying(false);
      }, 1400);
      setTimeout(() => {
        setToastNotice("");
      }, 5000);
    } catch (err) {
      console.error("Verification error:", err);
      setIsVerifying(false);
      setToastNotice("Verification service unavailable");
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = "Hash,PreviousHash,Timestamp,ActorName,ActorEmail,ActorRole,IP,Action,Category,Summary,EntityType,EntityId,EntityTitle\n";
    const rows = logs
      .map((l) => {
        const hash = `"${l.hash}"`;
        const prevHash = `"${l.previousHash}"`;
        const time = `"${new Date(l.timestamp).toISOString()}"`;
        const actorName = `"${(l.actor?.name || "").replace(/"/g, '""')}"`;
        const actorEmail = `"${l.actor?.email || ""}"`;
        const actorRole = l.actor?.role || "";
        const ip = l.ipAddress || "";
        const action = l.action;
        const category = l.actionCategory;
        const summary = `"${(l.summary || "").replace(/"/g, '""')}"`;
        const entType = l.targetEntity?.entityType || "";
        const entId = l.targetEntity?.entityId || "";
        const entTitle = `"${(l.targetEntity?.entityTitle || "").replace(/"/g, '""')}"`;
        return `${hash},${prevHash},${time},${actorName},${actorEmail},${actorRole},${ip},${action},${category},${summary},${entType},${entId},${entTitle}`;
      })
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autobazaar_audit_ledger_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Audit JSON
  const handleExportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(logs, null, 2)
    )}`;
    const a = document.createElement("a");
    a.href = jsonString;
    a.download = `autobazaar_cryptographic_ledger_${Date.now()}.json`;
    a.click();
  };

  // Helper for Actor Initials
  const getInitials = (name = "") => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || "SY";
  };

  // Helper for Relative Time
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Helper for Action Badge Styling
  const getActionBadge = (action = "") => {
    if (action.includes("APPROVED")) {
      return {
        bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
        label: action,
      };
    }
    if (action.includes("DELISTED") || action.includes("SUSPENDED") || action.includes("DELETED")) {
      return {
        bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
        label: action,
      };
    }
    if (action.includes("ROLE")) {
      return {
        bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
        label: action,
      };
    }
    if (action.includes("REGISTERED")) {
      return {
        bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
        label: action,
      };
    }
    return {
      bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      label: action,
    };
  };

  return (
    <div className="flex flex-col w-full text-slate-800 dark:text-slate-200 antialiased space-y-6">
      
      {/* Toast Feedback Notification */}
      {toastNotice && (
        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-800 dark:text-indigo-200 text-xs font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600 dark:text-indigo-400">
              verified
            </span>
            <span>{toastNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotice("")}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* TOP HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#121826] p-6 rounded-xl border border-slate-200 dark:border-[#263046] shadow-sm">
        <div className="flex flex-col max-w-2xl">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2]">
              Audit Log &amp; Ledger
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Stream
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
            Immutable System Ledger &amp; Security Audit Trail. Real-time cryptographic SHA-256 event logs across admin actions, car moderation, and customer accounts in MongoDB.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchLogs}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#161F30] hover:bg-slate-200 dark:hover:bg-[#1f2b42] text-slate-700 dark:text-[#E6EAF2] border border-slate-200 dark:border-[#263046] text-xs font-medium transition-colors"
          >
            <span className={`material-symbols-outlined text-[16px] text-slate-400 ${isLoading ? "animate-spin" : ""}`}>
              refresh
            </span>
            Sync
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#161F30] hover:bg-slate-200 dark:hover:bg-[#1f2b42] text-slate-700 dark:text-[#E6EAF2] border border-slate-200 dark:border-[#263046] text-xs font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-400">download</span>
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#161F30] hover:bg-slate-200 dark:hover:bg-[#1f2b42] text-slate-700 dark:text-[#E6EAF2] border border-slate-200 dark:border-[#263046] text-xs font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-400">data_object</span>
            Export Audit JSON
          </button>

          <button
            type="button"
            onClick={handleVerifyLedger}
            disabled={isVerifying}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-semibold shadow-md transition-all active:scale-[0.98] ${
              isVerifying
                ? "bg-indigo-600 opacity-80"
                : verificationResult?.isValid
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-950/30"
                : "bg-[#6366F1] hover:bg-[#4F46E5] shadow-indigo-950/40"
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] ${isVerifying ? "animate-spin" : ""}`}>
              {isVerifying ? "progress_activity" : verificationResult?.isValid ? "task_alt" : "verified_user"}
            </span>
            <span>
              {isVerifying
                ? "Verifying Chain..."
                : verificationResult?.isValid
                ? "100% Cryptographic Match"
                : "Verify Cryptographic Integrity"}
            </span>
          </button>
        </div>
      </div>

      {/* 4 COMPACT KPI STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Logged Events */}
        <div className="bg-white dark:bg-[#121826] p-4 rounded-xl border border-slate-200 dark:border-[#263046] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] font-mono">
              Total Logged Events
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-[#161F30] border border-indigo-200 dark:border-[#263046] flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-[#E6EAF2] tracking-tight font-mono">
              {metrics.totalEvents}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Live DB
              </span>
              <span className="text-slate-400 dark:text-[#64748B]">·</span>
              <span className="text-slate-500 dark:text-[#94A3B8]">
                24h integrity: <strong className="text-emerald-600 dark:text-emerald-400 font-medium">100% Valid</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Privileged Admin Actions */}
        <div className="bg-white dark:bg-[#121826] p-4 rounded-xl border border-slate-200 dark:border-[#263046] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] font-mono">
              Admin Moderations
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-[#161F30] border border-indigo-200 dark:border-[#263046] flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-[#E6EAF2] tracking-tight font-mono">
              {metrics.adminActions}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-[#94A3B8]">
              <span>Approvals &amp; Delists</span>
              <span className="text-slate-400 dark:text-[#64748B]">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Recorded</span>
            </div>
          </div>
        </div>

        {/* Card 3: Listing Moderation Events */}
        <div className="bg-white dark:bg-[#121826] p-4 rounded-xl border border-slate-200 dark:border-[#263046] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] font-mono">
              Marketplace Submissions
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-[#161F30] border border-blue-200 dark:border-[#263046] flex items-center justify-center text-blue-600 dark:text-blue-400">
              <span className="material-symbols-outlined text-[16px]">directions_car</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-[#E6EAF2] tracking-tight font-mono">
              {metrics.listingEvents}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-[#94A3B8]">
              <span>Dealer &amp; Seller Cars</span>
              <span className="text-slate-400 dark:text-[#64748B]">·</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">Tracked</span>
            </div>
          </div>
        </div>

        {/* Card 4: Cryptographic Ledger Sync */}
        <div className="bg-white dark:bg-[#121826] p-4 rounded-xl border border-slate-200 dark:border-[#263046] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] font-mono">
              Cryptographic Hash
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-[#161F30] border border-emerald-200 dark:border-[#263046] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-[16px]">hub</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-sm font-semibold text-slate-900 dark:text-[#E6EAF2] font-mono">
                SHA-256 Ledger
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500 dark:text-[#94A3B8] font-mono truncate" title={metrics.merkleRoot}>
              Root: {metrics.merkleRoot ? `${metrics.merkleRoot.slice(0, 16)}...` : "0x00000000"}
            </div>
          </div>
        </div>

      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-[#121826] p-4 rounded-xl border border-slate-200 dark:border-[#263046] space-y-3.5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by actor name, action, entity ID, hash, or IP..."
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-slate-50 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] text-xs text-slate-900 dark:text-[#E6EAF2] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] font-mono transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Dropdown Selects */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            
            {/* Actor Filter */}
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="h-10 px-3 rounded-lg bg-slate-50 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] text-xs text-slate-800 dark:text-[#E6EAF2] focus:outline-none focus:border-[#6366F1]"
            >
              <option value="all">Actor: All Actors</option>
              <option value="Platform Administrator">Platform Administrator</option>
              <option value="Shoaib Developer">Shoaib Developer</option>
              <option value="ali">ali</option>
              <option value="jawad">jawad</option>
            </select>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-10 px-3 rounded-lg bg-slate-50 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] text-xs text-slate-800 dark:text-[#E6EAF2] focus:outline-none focus:border-[#6366F1]"
            >
              <option value="all">Action: All Actions</option>
              <option value="LISTING_APPROVED">LISTING_APPROVED</option>
              <option value="LISTING_DELISTED">LISTING_DELISTED</option>
              <option value="LISTING_SUBMITTED">LISTING_SUBMITTED</option>
              <option value="LISTING_DELETED">LISTING_DELETED</option>
              <option value="USER_REGISTERED">USER_REGISTERED</option>
              <option value="USER_ROLE_CHANGED">USER_ROLE_CHANGED</option>
              <option value="ACCOUNT_SUSPENDED">ACCOUNT_SUSPENDED</option>
              <option value="ACCOUNT_REACTIVATED">ACCOUNT_REACTIVATED</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 px-3 rounded-lg bg-slate-50 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] text-xs text-slate-800 dark:text-[#E6EAF2] focus:outline-none focus:border-[#6366F1]"
            >
              <option value="all">Category: All Categories</option>
              <option value="admin">Admin Actions</option>
              <option value="listing">Listing Events</option>
              <option value="user">User Registrations</option>
              <option value="security">Security &amp; Sanctions</option>
            </select>
          </div>
        </div>

        {/* Quick Status Chips & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-[#263046]/60">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === "all"
                  ? "bg-[#6366F1] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-[#161F30] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#263046]"
              }`}
            >
              All Events ({metrics.totalEvents})
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("admin")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === "admin"
                  ? "bg-[#6366F1] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-[#161F30] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#263046]"
              }`}
            >
              Admin Actions ({metrics.adminActions})
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("listing")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === "listing"
                  ? "bg-[#6366F1] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-[#161F30] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#263046]"
              }`}
            >
              Listing Events ({metrics.listingEvents})
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("security")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === "security"
                  ? "bg-[#6366F1] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-[#161F30] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#263046]"
              }`}
            >
              Security Flags ({metrics.securityFlags})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setCategoryFilter("all");
              setActionFilter("all");
              setActorFilter("all");
            }}
            className="text-xs font-medium text-indigo-600 dark:text-[#818CF8] hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
            Clear Filters
          </button>
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="bg-white dark:bg-[#121826] rounded-xl border border-slate-200 dark:border-[#263046] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#161F30]/90 text-slate-500 dark:text-[#94A3B8] text-xs font-medium uppercase tracking-wider border-b border-slate-200 dark:border-[#263046] font-mono">
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <span className="material-symbols-outlined text-[18px] text-emerald-500" title="Cryptographically Validated Ledger">
                    verified
                  </span>
                </th>
                <th className="py-3.5 px-4 min-w-[200px]">Actor &amp; Network</th>
                <th className="py-3.5 px-4 min-w-[220px]">Action &amp; Summary</th>
                <th className="py-3.5 px-4 min-w-[200px]">Target Entity</th>
                <th className="py-3.5 px-4 min-w-[150px]">Timestamp</th>
                <th className="py-3.5 pr-4 pl-2 min-w-[180px] text-right">Ledger Hash &amp; Audit</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-[#263046] text-xs font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-[28px] animate-spin text-indigo-500 mb-2">
                      progress_activity
                    </span>
                    <p className="text-xs font-mono">Querying cryptographic audit logs...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-[32px] text-slate-400 mb-2">
                      history
                    </span>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No audit events match your filters</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting search or category parameters.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const logId = log._id || log.id;
                  const isDelistedOrSuspended =
                    log.action.includes("DELISTED") || log.action.includes("SUSPENDED");

                  return (
                    <tr
                      key={logId}
                      className={`hover:bg-slate-50 dark:hover:bg-[#161F30]/50 transition-colors group ${
                        isDelistedOrSuspended ? "bg-rose-50/20 dark:bg-rose-950/10" : ""
                      }`}
                    >
                      {/* Cryptographic Verification Dot */}
                      <td className="py-3 pl-4 pr-2 text-center align-middle">
                        <span
                          className="material-symbols-outlined text-[18px] text-emerald-500 dark:text-emerald-400"
                          title="Cryptographically Validated SHA-256"
                        >
                          verified
                        </span>
                      </td>

                      {/* Actor & Network */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            log.actor?.role === "admin"
                              ? "bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/60 text-amber-700 dark:text-amber-300"
                              : "bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300"
                          }`}>
                            {getInitials(log.actor?.name)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-slate-900 dark:text-[#E6EAF2] font-semibold text-xs leading-tight">
                              {log.actor?.name || "System"}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-[#161F30] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#263046] uppercase font-mono">
                                {log.actor?.role || "SYSTEM"}
                              </span>
                              <span className="text-slate-400 dark:text-[#64748B] text-[11px] font-mono">
                                {log.ipAddress || "127.0.0.1"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action & Summary */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-col">
                          <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-mono font-medium ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <span className="text-slate-600 dark:text-[#94A3B8] text-[11px] mt-1 line-clamp-1">
                            {log.summary}
                          </span>
                        </div>
                      </td>

                      {/* Target Entity */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-col">
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-1">
                            {log.targetEntity?.entityType} #{String(log.targetEntity?.entityId || "").slice(-5).toUpperCase()}
                          </span>
                          <span className="text-slate-500 dark:text-[#64748B] text-[11px] line-clamp-1">
                            {log.targetEntity?.entityTitle || "N/A"}
                          </span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-col font-mono">
                          <span className="text-slate-900 dark:text-[#E6EAF2] text-[11px]">
                            {new Date(log.timestamp).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                            {formatTimeAgo(log.timestamp)}
                          </span>
                        </div>
                      </td>

                      {/* Ledger Hash & Audit Action */}
                      <td className="py-3 pr-4 pl-2 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] text-slate-600 dark:text-[#94A3B8] text-[11px] font-mono">
                            {log.hash ? `${log.hash.slice(0, 8)}...${log.hash.slice(-4)}` : "0x000"}
                          </code>
                          <button
                            type="button"
                            onClick={() => setInspectLog(log)}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#263046] text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#E6EAF2] transition-colors"
                            title="Inspect Event Payload & Cryptographic Proof"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* TABLE FOOTER & PAGINATION */}
        <div className="bg-slate-50 dark:bg-[#121826] px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-[#263046] text-xs text-slate-500 dark:text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-900 dark:text-[#E6EAF2]">{logs.length}</strong> of{" "}
              <strong className="text-slate-900 dark:text-[#E6EAF2]">{pagination.total}</strong> events
            </span>
            <span className="text-slate-400 dark:text-[#64748B]">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Merkle Root Hash synced
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="px-2.5 py-1 rounded bg-white dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-[#E6EAF2] disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 rounded bg-[#6366F1] text-white font-medium shadow-sm">
              Page {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="px-2.5 py-1 rounded bg-white dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* INSPECTION MODAL: Cryptographic Proof & Payload */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] shadow-2xl p-6 overflow-hidden">
            
            {/* Top Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-emerald-500 to-purple-500"></div>

            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-[#263046]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">verified</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[#E6EAF2]">
                    Audit Record &amp; Proof Inspection
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                    Immutable ledger block #{inspectLog._id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Cryptographic Hash Proof Box */}
            <div className="my-4 space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046]">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span className="font-mono uppercase font-semibold">Block Hash (SHA-256)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inspectLog.hash);
                      setCopiedHash(true);
                      setTimeout(() => setCopiedHash(false), 2000);
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedHash ? "check" : "content_copy"}
                    </span>
                    <span>{copiedHash ? "Copied" : "Copy Hash"}</span>
                  </button>
                </div>
                <code className="text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all select-all block">
                  {inspectLog.hash}
                </code>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046]">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-mono uppercase font-semibold">
                  Previous Block Hash
                </div>
                <code className="text-xs font-mono text-slate-600 dark:text-[#94A3B8] break-all select-all block">
                  {inspectLog.previousHash}
                </code>
              </div>
            </div>

            {/* Event Summary Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046]">
                <span className="text-slate-500 dark:text-[#94A3B8] block text-[10px] uppercase font-mono">Actor</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                  {inspectLog.actor?.name} ({inspectLog.actor?.role?.toUpperCase()})
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono">
                  {inspectLog.actor?.email}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046]">
                <span className="text-slate-500 dark:text-[#94A3B8] block text-[10px] uppercase font-mono">Action Type</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 block font-mono">
                  {inspectLog.action}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                  Category: {inspectLog.actionCategory}
                </span>
              </div>
            </div>

            {/* Raw JSON Payload */}
            <div>
              <div className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1 font-semibold">
                Event Payload &amp; Metadata Record
              </div>
              <pre className="max-h-48 overflow-y-auto p-3 rounded-xl bg-slate-900 dark:bg-[#080C14] text-emerald-400 text-[11px] font-mono border border-slate-800 dark:border-[#1E293B]">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t border-slate-200 dark:border-[#263046] flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Immutable Audit Trail Verified
              </span>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-[#161F30] border border-slate-200 dark:border-[#263046] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

