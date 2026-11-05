import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar";
import AdminHeader from "../components/admin/AdminHeader";
import AdminDashboardOverview from "../components/admin/AdminDashboardOverview";
import AdminUsersDesk from "../components/admin/AdminUsersDesk";
import { useAuth } from "../context/AuthContext";
import { getAllPlatformCars, approveCar, rejectCar, deleteCarByAdmin } from "../api/admin.api";
import { formatCar } from "../api/cars.api";

// Preset violation categories matching the reference modal
const VIOLATION_CATEGORIES = [
  "Document / VIN Discrepancy",
  "Odometer Rollback Violation",
  "Escrow / Advance Scam Flag",
  "Blurry or Misleading Photos",
  "Unrealistic or Placeholder Price",
  "Other Administrative Sanction",
];

export default function AdminModerationPage({
  onOpenAuth,
  isDarkMode = true,
  onToggleTheme,
}) {
  const { user, isAuthenticated, isAdmin } = useAuth();

  // Navigation tab state ('dashboard' | 'listings' | 'users' | 'reports' | 'audit-log' | 'system-settings')
  const [activeTab, setActiveTab] = useState("dashboard");

  // Cars dataset state
  const [allCars, setAllCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState(null); // { type: 'success' | 'error' | 'info', message: string }
  const [processingCarId, setProcessingCarId] = useState(null);

  // Filters state
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'pending_review' | 'published' | 'rejected'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedMake, setSelectedMake] = useState("all");

  // Selection state for batch actions
  const [selectedCarIds, setSelectedCarIds] = useState(new Set());

  // Modal State for Reject / Sanction
  const [modalCar, setModalCar] = useState(null);
  const [modalViolationCategory, setModalViolationCategory] = useState("Document / VIN Discrepancy");
  const [modalAuditNote, setModalAuditNote] = useState("");
  const [modalDelistToggle, setModalDelistToggle] = useState(true);
  const [modalNotifyToggle, setModalNotifyToggle] = useState(true);
  const [modalError, setModalError] = useState("");

  // Delete Modal State (Custom UI Popup)
  const [deleteModalCar, setDeleteModalCar] = useState(null);

  // Inspect Photo Modal
  const [inspectCar, setInspectCar] = useState(null);
  const [inspectPhotoIdx, setInspectPhotoIdx] = useState(0);

  // Fetch all cars for admin console
  const fetchCars = useCallback(async () => {
    if (!isAuthenticated || !isAdmin) return;
    try {
      setIsLoading(true);
      setError("");
      const res = await getAllPlatformCars({ limit: 50 });
      const rawList = res?.cars || [];
      const formatted = rawList.map(formatCar);
      setAllCars(formatted);
    } catch (err) {
      console.error("Failed to load platform cars:", err);
      setError(err.message || "Failed to load listings console.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  // Derived KPI Metrics
  const metrics = useMemo(() => {
    const total = allCars.length;
    const pending = allCars.filter((c) => c.status === "pending_review").length;
    const published = allCars.filter((c) => c.status === "published").length;
    const rejected = allCars.filter((c) => c.status === "rejected").length;
    return { total, pending, published, rejected };
  }, [allCars]);

  // Filtered cars according to tabs and search inputs
  const filteredCars = useMemo(() => {
    return allCars.filter((car) => {
      // Status filter
      if (statusFilter === "pending_review") {
        if (car.status !== "pending_review") return false;
      } else if (statusFilter === "published") {
        if (car.status !== "published") return false;
      } else if (statusFilter === "rejected") {
        if (car.status !== "rejected") return false;
      }

      // City filter
      if (selectedCity !== "all") {
        if (car.city?.toLowerCase() !== selectedCity.toLowerCase()) return false;
      }

      // Make filter
      if (selectedMake !== "all") {
        if (car.make?.toLowerCase() !== selectedMake.toLowerCase()) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = car.title?.toLowerCase().includes(query);
        const sellerNameMatch = car.seller?.name?.toLowerCase().includes(query);
        const sellerEmailMatch = car.seller?.email?.toLowerCase().includes(query);
        const cityMatch = car.city?.toLowerCase().includes(query);
        return titleMatch || sellerNameMatch || sellerEmailMatch || cityMatch;
      }

      return true;
    });
  }, [allCars, statusFilter, selectedCity, selectedMake, searchQuery]);

  // Batch Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedCarIds.size === filteredCars.length) {
      setSelectedCarIds(new Set());
    } else {
      setSelectedCarIds(new Set(filteredCars.map((c) => c.id)));
    }
  };

  const handleToggleSelectCar = (id) => {
    setSelectedCarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Quick Approve Listing
  const handleApproveCar = async (car) => {
    try {
      setProcessingCarId(car.id);
      await approveCar(car.id);

      // Optimistically update status in state
      setAllCars((prev) =>
        prev.map((item) =>
          item.id === car.id ? { ...item, status: "published", rejectionReason: "" } : item
        )
      );

      setActionNotice({
        type: "success",
        message: `Listing "${car.title}" approved and published live across Pakistan.`,
      });
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      setActionNotice({
        type: "error",
        message: err.message || "Failed to approve listing.",
      });
    } finally {
      setProcessingCarId(null);
    }
  };

  // Open Rejection / Sanction Modal
  const openSanctionModal = (car) => {
    setModalCar(car);
    setModalViolationCategory("Document / VIN Discrepancy");
    setModalAuditNote(
      car.rejectionReason ||
      "Internal Audit note: Vehicle requires verification of engine/chassis number and updated photos."
    );
    setModalDelistToggle(true);
    setModalNotifyToggle(true);
    setModalError("");
  };

  const closeSanctionModal = () => {
    setModalCar(null);
    setModalError("");
  };

  // Confirm Rejection / Sanction
  const handleConfirmSanction = async () => {
    if (!modalAuditNote.trim()) {
      setModalError("Please provide an audit rationale or evidence note.");
      return;
    }
    if (modalAuditNote.trim().length < 5) {
      setModalError("Reason note must be at least 5 characters.");
      return;
    }

    try {
      setProcessingCarId(modalCar.id);
      const combinedReason = `[${modalViolationCategory}] ${modalAuditNote.trim()}`;
      await rejectCar(modalCar.id, combinedReason);

      // Optimistically update car state
      setAllCars((prev) =>
        prev.map((item) =>
          item.id === modalCar.id
            ? { ...item, status: "rejected", rejectionReason: combinedReason }
            : item
        )
      );

      const isDelisting = modalCar.status === "published";
      setActionNotice({
        type: "info",
        message: `Listing "${modalCar.title}" has been ${isDelisting ? "delisted and hidden from public marketplace" : "rejected and moved to hold"
          }. Notification dispatched.`,
      });

      closeSanctionModal();
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      setModalError(err.message || "Failed to submit sanction.");
    } finally {
      setProcessingCarId(null);
    }
  };

  // Master Delete Listing by Admin (Permanent Removal)
  const handleConfirmDeleteByAdmin = async () => {
    if (!deleteModalCar) return;

    try {
      setProcessingCarId(deleteModalCar.id);
      await deleteCarByAdmin(deleteModalCar.id);

      // Remove car completely from local dataset
      setAllCars((prev) => prev.filter((item) => item.id !== deleteModalCar.id));

      setActionNotice({
        type: "info",
        message: `Listing "${deleteModalCar.title}" has been permanently deleted from database.`,
      });
      setDeleteModalCar(null);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      console.error("Failed to delete listing by admin:", err);
      setActionNotice({
        type: "error",
        message: err.message || "Failed to delete listing.",
      });
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setProcessingCarId(null);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setStatusFilter("all");
    setSearchQuery("");
    setSelectedCity("all");
    setSelectedMake("all");
    setSelectedCarIds(new Set());
  };

  // Access Control Guard
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F1A] flex items-center justify-center p-4 text-slate-800 dark:text-slate-200 transition-colors duration-200">
        <div className="w-full max-w-md p-8 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] text-center shadow-2xl transition-colors">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
            Superuser Console Restricted
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            Access to the AutoBazaar Enterprise Operations Console is restricted to authorized superusers.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              Sign In as Superuser
            </button>
            <Link
              to="/"
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-[#263046] hover:bg-slate-100 dark:hover:bg-[#161F30] text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
            >
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F1A] text-slate-800 dark:text-slate-200 font-sans antialiased transition-colors duration-200">
      {/* 1. Left Enterprise Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={metrics.pending}
      />

      {/* 2. Top Header Bar */}
      <div className="pl-64">
        <AdminHeader
          activeTab={activeTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isDarkMode={isDarkMode}
          onToggleTheme={onToggleTheme}
          user={user}
        />

        {/* 3. Main Operational Content Body */}
        <main className="w-full pt-20 px-8 pb-12 flex flex-col gap-6">

          {/* Action Notification Alert (Global for all tabs) */}
          {actionNotice && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-medium border animate-in fade-in transition-colors ${actionNotice.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : actionNotice.type === "info"
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">
                  {actionNotice.type === "success" ? "check_circle" : "info"}
                </span>
                <span>{actionNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="hover:opacity-75"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {activeTab === "dashboard" ? (
            <AdminDashboardOverview
              allCars={allCars}
              metrics={metrics}
              onNavigateToListings={() => setActiveTab("listings")}
              onApproveCar={handleApproveCar}
              onRejectCar={openSanctionModal}
              onInspectCar={(car) => {
                setInspectCar(car);
                setInspectPhotoIdx(0);
              }}
              processingCarId={processingCarId}
            />
          ) : activeTab === "users" ? (
            <AdminUsersDesk currentAdminId={user?._id || user?.id} />
          ) : (
            <>
              {/* Sub-header Breadcrumb & Operational Mode Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#263046]">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <span className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer">
                      ADMIN CONSOLE
                    </span>
                    <span>/</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold tracking-wide">
                      VEHICLE REGISTRY & QUALITY DESK
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2]">
                      Vehicle Moderation Desk
                    </h1>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 shadow-sm transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                      Live Marketplace Registry
                    </span>
                  </div>
                </div>

                {/* Right Header Actions */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={fetchCars}
                    className="h-9 px-3 rounded-lg bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] hover:bg-slate-100 dark:hover:bg-[#161F30] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm"
                  >
                    <span className={`material-symbols-outlined text-[17px] text-slate-500 dark:text-slate-400 ${isLoading ? "animate-spin" : ""}`}>
                      refresh
                    </span>
                    Sync Feeds
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const csvData = allCars.map(c => `${c.title},${c.price},${c.city},${c.status}`).join("\n");
                      const blob = new Blob([csvData], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `autobazaar_listings_${Date.now()}.csv`;
                      a.click();
                    }}
                    className="h-9 px-3 rounded-lg bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] hover:bg-slate-100 dark:hover:bg-[#161F30] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[17px] text-slate-500 dark:text-slate-400">
                      file_download
                    </span>
                    Export CSV
                  </button>

                  <Link
                    to="/sell"
                    className="h-9 px-3.5 rounded-lg bg-[#6366F1] hover:bg-[#5558E6] text-white transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm shadow-indigo-500/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      add
                    </span>
                    + Add Listing
                  </Link>
                </div>
              </div>

              {/* 1. Top KPI Summary Cards (4 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Card 1: Total Users / Inventory */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider font-mono">
                      Total Listings
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[16px]">groups</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2]">
                      {metrics.total.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-flex items-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        +12.4%
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">across Pakistan hubs</span>
                    </div>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
                </div>

                {/* Card 2: Active Sellers & Published */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider font-mono">
                      Active Published Inventory
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[16px]">storefront</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2]">
                      {metrics.published.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/30 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-medium">
                        100% Certified
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Live on marketplace</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Pending Review / NADRA Desk */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider font-mono">
                      Pending Moderation
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-[#271E14] border border-amber-500/30 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-300">
                      {metrics.pending}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>Requires desk review (Avg: 2.1h)</span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Suspended / Rejected Listings */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider font-mono">
                      Sanctioned / Held
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 dark:bg-[#2A161E] border border-rose-500/30 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <span className="material-symbols-outlined text-[16px]">gavel</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-300">
                      {metrics.rejected}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span>Under quality or fraud check</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Action & Filter Toolbar */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col gap-3.5 shadow-sm transition-colors">
                {/* Row 1: Search & Filter Tabs */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-xl">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by vehicle title, seller name, city, or engine..."
                      className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-xs text-slate-900 dark:text-[#E6EAF2] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                    />
                    <span className="absolute right-2.5 top-2.5 text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#162032] border border-slate-300 dark:border-[#263046]">
                      ⌘K
                    </span>
                  </div>

                  {/* Segmented Status Tabs */}
                  <div className="flex items-center overflow-x-auto no-scrollbar bg-slate-100 dark:bg-[#0B0F1A] p-1 rounded-lg border border-slate-200 dark:border-[#263046] text-xs transition-colors">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${statusFilter === "all"
                          ? "text-slate-900 dark:text-white bg-white dark:bg-[#1A2234] border border-slate-300 dark:border-[#32405D] shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                      <span>All</span>
                      <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 px-1 rounded bg-slate-200 dark:bg-[#0B0F1A]">
                        {metrics.total}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusFilter("published")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${statusFilter === "published"
                          ? "text-slate-900 dark:text-white bg-white dark:bg-[#1A2234] border border-slate-300 dark:border-[#32405D] shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                      <span>Active</span>
                      <span className="text-[10px] font-mono text-slate-600 dark:text-slate-500 px-1 rounded bg-slate-200 dark:bg-[#121826]">
                        {metrics.published}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusFilter("pending_review")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${statusFilter === "pending_review"
                          ? "text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-950/60 border border-amber-500/30 dark:border-amber-800 shadow-sm font-semibold"
                          : "text-amber-600 dark:text-amber-400/90 hover:text-amber-700 dark:hover:text-amber-300"
                        }`}
                    >
                      <span>Pending Verification</span>
                      <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400/80 px-1 rounded bg-amber-500/20 dark:bg-amber-950/40 border border-amber-500/30 dark:border-amber-800/40">
                        {metrics.pending}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusFilter("rejected")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${statusFilter === "rejected"
                          ? "text-rose-700 dark:text-rose-300 bg-rose-500/10 dark:bg-rose-950/60 border border-rose-500/30 dark:border-rose-800 shadow-sm font-semibold"
                          : "text-rose-600 dark:text-rose-400/90 hover:text-rose-700 dark:hover:text-rose-300"
                        }`}
                    >
                      <span>Suspended</span>
                      <span className="text-[10px] font-mono text-rose-700 dark:text-rose-400/80 px-1 rounded bg-rose-500/20 dark:bg-rose-950/40 border border-rose-500/30 dark:border-rose-800/40">
                        {metrics.rejected}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Row 2: Secondary Dropdowns & Fast Filters */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-[#1C263A] text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Make Dropdown */}
                    <div className="relative">
                      <select
                        value={selectedMake}
                        onChange={(e) => setSelectedMake(e.target.value)}
                        className="appearance-none h-8 pl-2.5 pr-7 rounded bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="all">Make: All Makes</option>
                        <option value="toyota">Toyota</option>
                        <option value="suzuki">Suzuki</option>
                        <option value="honda">Honda</option>
                        <option value="kia">KIA</option>
                        <option value="hyundai">Hyundai</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-1.5 top-2 text-slate-400 text-[16px] pointer-events-none">
                        expand_more
                      </span>
                    </div>

                    {/* Region Dropdown */}
                    <div className="relative">
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="appearance-none h-8 pl-2.5 pr-7 rounded bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="all">Region: All Pakistan</option>
                        <option value="lahore">Punjab (Lahore, RWP, FSD)</option>
                        <option value="karachi">Sindh (Karachi, Hyderabad)</option>
                        <option value="islamabad">Islamabad Capital (ICT)</option>
                        <option value="peshawar">Khyber Pakhtunkhwa (KPK)</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-1.5 top-2 text-slate-400 text-[16px] pointer-events-none">
                        expand_more
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="h-8 px-2.5 rounded bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
                      <span>Reset</span>
                    </button>
                  </div>

                  {/* Batch Action Status */}
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                    <span>{selectedCarIds.size} listings selected for batch action</span>
                    {selectedCarIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionNotice({
                            type: "info",
                            message: `Batch action triggered on ${selectedCarIds.size} listings.`,
                          });
                          setTimeout(() => setActionNotice(null), 4000);
                        }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-[#1A2234] border border-slate-200 dark:border-[#263046] text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        Batch Action
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Searchable Vehicles & Moderation Table */}
              <div className="rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] shadow-sm overflow-hidden flex flex-col transition-colors">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    {/* Table Header */}
                    <thead className="bg-slate-50 dark:bg-[#0D1322] border-b border-slate-200 dark:border-[#263046] text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider text-[10px] transition-colors">
                      <tr>
                        <th className="py-3 px-3.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredCars.length > 0 && selectedCarIds.size === filteredCars.length}
                            onChange={handleToggleSelectAll}
                            className="rounded bg-slate-50 dark:bg-[#0B0F1A] border-slate-300 dark:border-[#263046] text-indigo-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                          />
                        </th>
                        <th className="py-3 px-3">Vehicle & Details</th>
                        <th className="py-3 px-3">Seller Verification</th>
                        <th className="py-3 px-3">Specs & Fuel</th>
                        <th className="py-3 px-3">Valuation (PKR)</th>
                        <th className="py-3 px-3">Moderation Status</th>
                        <th className="py-3 px-3">Submitted</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1C263A] transition-colors">
                      {isLoading ? (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-slate-500 dark:text-slate-400">
                            <div className="flex items-center justify-center gap-2">
                              <span className="material-symbols-outlined animate-spin text-xl text-indigo-500">
                                progress_activity
                              </span>
                              <span>Loading platform registry...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredCars.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-16 text-center text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-600">
                                inventory_2
                              </span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                No listings match current criteria
                              </span>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                Try resetting filters or checking the "All" tab.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredCars.map((car) => {
                          const isSelected = selectedCarIds.has(car.id);
                          const isPending = car.status === "pending_review";
                          const isPublished = car.status === "published";
                          const isRejected = car.status === "rejected";

                          return (
                            <tr
                              key={car.id}
                              className={`hover:bg-slate-50 dark:hover:bg-[#161F30]/60 transition-colors group ${isPending
                                  ? "bg-amber-500/5 dark:bg-amber-950/5"
                                  : isRejected
                                    ? "bg-rose-500/5 dark:bg-rose-950/10"
                                    : ""
                                }`}
                            >
                              {/* Checkbox */}
                              <td className="py-3.5 px-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectCar(car.id)}
                                  className="rounded bg-slate-50 dark:bg-[#0B0F1A] border-slate-300 dark:border-[#263046] text-indigo-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                                />
                              </td>

                              {/* Vehicle Thumbnail & Title */}
                              <td className="py-3.5 px-3">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInspectCar(car);
                                      setInspectPhotoIdx(0);
                                    }}
                                    className="w-12 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-[#263046] shrink-0 bg-slate-100 dark:bg-[#0B0F1A] hover:opacity-80 transition-opacity relative group/img shadow-sm"
                                  >
                                    <img
                                      src={car.image}
                                      alt={car.title}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.src = "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80";
                                      }}
                                    />
                                    {car.images?.length > 1 && (
                                      <span className="absolute bottom-0 right-0 px-1 bg-black/70 text-[9px] font-mono text-white">
                                        {car.images.length}
                                      </span>
                                    )}
                                  </button>

                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 capitalize">
                                      <span>{car.title}</span>
                                      {isPublished && (
                                        <span
                                          className="material-symbols-outlined text-[14px] text-emerald-500 dark:text-emerald-400"
                                          title="Approved and Live"
                                        >
                                          verified
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                      <span className="capitalize">{car.city}</span>
                                      <span>•</span>
                                      <span className="capitalize">{car.bodyType}</span>
                                      <span>•</span>
                                      <span className="font-mono text-slate-400 dark:text-slate-500">ID: #{car.id?.slice(-6)}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Seller Details */}
                              <td className="py-3.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#1A2234] border border-slate-200 dark:border-[#2B3954] flex items-center justify-center font-bold text-[10px] text-indigo-600 dark:text-indigo-300">
                                    {car.seller?.name ? car.seller.name.charAt(0).toUpperCase() : "S"}
                                  </div>
                                  <div>
                                    <span className="font-medium text-slate-800 dark:text-slate-200 block text-xs">
                                      {car.seller?.name || "Private Seller"}
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 block">
                                      {car.seller?.phoneNumber || car.seller?.email || "shoaib@test.com"}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Specs */}
                              <td className="py-3.5 px-3">
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  {car.year} • {car.fuel}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  {car.mileage} • {car.transmission}
                                </div>
                              </td>

                              {/* Valuation (PKR) */}
                              <td className="py-3.5 px-3">
                                <div className="font-bold font-mono text-xs text-indigo-600 dark:text-indigo-300">
                                  {car.priceFormatted}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                  Direct Seller Asking
                                </div>
                              </td>

                              {/* Status Badge with Live Pulsing Dot */}
                              <td className="py-3.5 px-3">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 dark:bg-amber-950/70 border border-amber-500/30 dark:border-amber-800/80 text-amber-700 dark:text-amber-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    Pending Review
                                  </span>
                                ) : isPublished ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 dark:bg-emerald-950/70 border border-emerald-500/30 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                                    Published
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 dark:bg-rose-950/70 border border-rose-500/30 dark:border-rose-800/80 text-rose-700 dark:text-rose-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    Suspended
                                  </span>
                                )}
                              </td>

                              {/* Activity / Timestamp */}
                              <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {isPending ? "Pending Desk" : "Live Feed"}
                              </td>

                              {/* Action Buttons */}
                              <td className="py-3.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isPending ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={processingCarId === car.id}
                                        onClick={() => handleApproveCar(car)}
                                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">
                                          check_circle
                                        </span>
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        disabled={processingCarId === car.id}
                                        onClick={() => openSanctionModal(car)}
                                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:border-rose-300 dark:hover:border-rose-800 text-rose-600 dark:text-rose-300 transition-colors text-xs font-medium disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : isPublished ? (
                                    <button
                                      type="button"
                                      disabled={processingCarId === car.id}
                                      onClick={() => openSanctionModal(car)}
                                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] hover:bg-slate-200 dark:hover:bg-[#1E293B] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-medium disabled:opacity-50"
                                    >
                                      Delist
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={processingCarId === car.id}
                                      onClick={() => handleApproveCar(car)}
                                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#162032] border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-[#1E293B] text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-medium disabled:opacity-50"
                                    >
                                      Reactivate
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInspectCar(car);
                                      setInspectPhotoIdx(0);
                                    }}
                                    className="w-7 h-7 rounded bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] hover:bg-slate-200 dark:hover:bg-[#1E293B] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
                                    title="Inspect listing photos"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={processingCarId === car.id}
                                    onClick={() => setDeleteModalCar(car)}
                                    className="w-7 h-7 rounded bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:border-rose-300 dark:hover:border-rose-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors disabled:opacity-50"
                                    title="Admin: Permanently delete car entity from database"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
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

                {/* Table Pagination Footer */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-[#0D1322] border-t border-slate-200 dark:border-[#263046] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition-colors">
                  <div className="text-slate-500 dark:text-slate-400">
                    Showing <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">1</span> to{" "}
                    <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">{filteredCars.length}</span> of{" "}
                    <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">{allCars.length}</span> platform listings
                  </div>

                  <div className="flex items-center gap-1.5 font-mono">
                    <button
                      type="button"
                      disabled
                      className="h-8 px-2.5 rounded bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] text-slate-400 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                      <span>Prev</span>
                    </button>
                    <button
                      type="button"
                      className="w-8 h-8 rounded bg-indigo-600 text-white font-medium flex items-center justify-center shadow-sm"
                    >
                      1
                    </button>
                    <button
                      type="button"
                      disabled
                      className="h-8 px-2.5 rounded bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] text-slate-400 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      <span>Next</span>
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 4. Embedded / Active State Modal: "Suspend / Sanction Listing" */}
          {modalCar && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="relative w-full max-w-2xl mx-auto rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] shadow-2xl p-6 overflow-hidden transition-colors">

                {/* Top Decorative Accent Gradient */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500"></div>

                {/* Modal Header */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-[#263046]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-950/80 border border-rose-500/30 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <span className="material-symbols-outlined text-[24px]">gavel</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-[#E6EAF2]">
                        {modalCar.status === "published" ? "Delist & Suspend Listing" : "Reject Listing"}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {modalCar.status === "published"
                          ? "Remove vehicle from public marketplace & apply administrative hold"
                          : "Reject pending submission & notify seller of discrepancies"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeSanctionModal}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Target User & Vehicle Snippet Card */}
                <div className="my-4 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-[#162032] border border-slate-300 dark:border-[#263046] flex items-center justify-center font-bold text-xs text-rose-600 dark:text-rose-300">
                      {modalCar.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 capitalize">
                        <span>{modalCar.title}</span>
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/10 dark:bg-rose-950 border border-rose-500/30 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[10px] font-mono">
                          ID: #{modalCar.id?.slice(-8)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        Valuation: {modalCar.priceFormatted} • {modalCar.city} • Seller: {modalCar.seller?.name || "shoaib@test.com"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-2 py-1 rounded bg-rose-500/10 dark:bg-rose-950/60 border border-rose-500/30 dark:border-rose-800/70 text-rose-600 dark:text-rose-300 text-[11px] font-mono font-medium">
                      Flagged Action
                    </span>
                  </div>
                </div>

                {/* Suspension Configuration Form */}
                <div className="space-y-4 text-xs">
                  {/* Reason Dropdown / Radio selection */}
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Violation Primary Category
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {VIOLATION_CATEGORIES.map((cat, idx) => (
                        <label
                          key={idx}
                          onClick={() => setModalViolationCategory(cat)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${modalViolationCategory === cat
                              ? "bg-slate-50 dark:bg-[#0B0F1A] border-rose-500 dark:border-rose-900/80 text-rose-700 dark:text-slate-100 shadow-sm"
                              : "bg-slate-50 dark:bg-[#0B0F1A] border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                        >
                          <input
                            type="radio"
                            name="violation"
                            checked={modalViolationCategory === cat}
                            onChange={() => setModalViolationCategory(cat)}
                            className="text-rose-600 focus:ring-0 bg-white dark:bg-[#121826] border-slate-300 dark:border-slate-700"
                          />
                          <span className={modalViolationCategory === cat ? "font-semibold text-slate-900 dark:text-slate-100" : ""}>
                            {cat}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Internal Audit Note */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-medium text-slate-700 dark:text-slate-300">
                        Internal Audit Note & Evidence Record
                      </label>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        Visible to Superadmins & Dispatched in Grievance Notice
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={modalAuditNote}
                      onChange={(e) => setModalAuditNote(e.target.value)}
                      placeholder="Document rationale, Punjab/Sindh Excise verification log, or complainant desk case ID..."
                      className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono transition-colors"
                    />
                    {modalError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-xs">error</span>
                        {modalError}
                      </p>
                    )}
                  </div>

                  {/* Switch Option 1: Delist vehicle */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-rose-500 dark:text-rose-400 text-[18px]">
                        remove_shopping_cart
                      </span>
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          Delist vehicle from public marketplace
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Immediately moves listing to rejected hold and hides card from buyers
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={modalDelistToggle}
                      onChange={(e) => setModalDelistToggle(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-[#263046] focus:ring-0 cursor-pointer"
                    />
                  </div>

                  {/* Switch Option 2: Dispatch Notice */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-slate-400 text-[18px]">
                        sms_failed
                      </span>
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          Send Suspension Notice (SMS + Email)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Trigger standard AutoBazaar legal grievance & appeal procedures
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={modalNotifyToggle}
                      onChange={(e) => setModalNotifyToggle(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-[#263046] focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#263046] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                    <span className="material-symbols-outlined text-[15px] text-amber-500 dark:text-amber-400">
                      shield
                    </span>
                    Action logged in Immutable Audit Trail (#AUD-7702)
                  </div>

                  <div className="flex items-center gap-2.5 justify-end">
                    <button
                      type="button"
                      onClick={closeSanctionModal}
                      disabled={processingCarId === modalCar.id}
                      className="h-9 px-4 rounded-lg bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-[#263046] hover:bg-slate-200 dark:hover:bg-[#25334a] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={processingCarId === modalCar.id}
                      onClick={handleConfirmSanction}
                      className="h-9 px-4 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white transition-colors text-xs font-medium flex items-center gap-1.5 shadow-sm shadow-rose-950 disabled:opacity-50"
                    >
                      {processingCarId === modalCar.id ? (
                        <>
                          <span className="material-symbols-outlined text-[17px] animate-spin">
                            progress_activity
                          </span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[17px]">block</span>
                          {modalCar.status === "published" ? "Confirm Delist" : "Confirm Suspension"}
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 5. Photo Inspection Lightbox */}
          {inspectCar && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
              <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] p-6 shadow-2xl flex flex-col gap-4">

                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#263046]">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 capitalize">
                      {inspectCar.title}
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {inspectCar.priceFormatted} • {inspectCar.city}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectCar(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2234] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>

                {/* Large Preview */}
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <img
                    src={inspectCar.images?.[inspectPhotoIdx] || inspectCar.image}
                    alt={inspectCar.title}
                    className="w-full h-full object-contain"
                  />
                  {inspectCar.images?.length > 1 && (
                    <div className="absolute inset-x-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setInspectPhotoIdx((prev) =>
                            prev === 0 ? inspectCar.images.length - 1 : prev - 1
                          )
                        }
                        className="w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90"
                      >
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setInspectPhotoIdx((prev) =>
                            prev === inspectCar.images.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90"
                      >
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {inspectCar.images?.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {inspectCar.images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setInspectPhotoIdx(idx)}
                        className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 ${idx === inspectPhotoIdx
                            ? "border-indigo-500 scale-105"
                            : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. Admin Master Action: Custom Delete Confirmation Modal */}
          {deleteModalCar && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
              <div className="relative w-full max-w-2xl mx-auto rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] shadow-2xl p-6 sm:p-7 overflow-hidden transition-colors">

                {/* Top Crimson Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-red-600 to-rose-700"></div>

                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-[#263046]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-rose-500/10 dark:bg-rose-950/80 border border-rose-500/30 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                      <span className="material-symbols-outlined text-[26px]">delete_forever</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-[#E6EAF2] tracking-tight">
                        Permanently Delete Listing
                      </h3>
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                        Administrative Superuser Wipe • Irreversible Database Action
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteModalCar(null)}
                    disabled={processingCarId === deleteModalCar.id}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[19px]">close</span>
                  </button>
                </div>

                {/* Prominent Vehicle Photo & Identity Card */}
                <div className="my-5">
                  <div className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-[#263046] shadow-inner bg-slate-900 group">
                    <img
                      src={deleteModalCar.image}
                      alt={deleteModalCar.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.src =
                          "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80";
                      }}
                    />

                    {/* Top Scrim Gradient & Metadata Badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/60 pointer-events-none"></div>

                    <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase backdrop-blur-md border ${deleteModalCar.status === "published"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : deleteModalCar.status === "pending_review"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        }`}>
                        {deleteModalCar.status === "published" ? "Live on Marketplace" : deleteModalCar.status === "pending_review" ? "Pending Verification" : "Suspended Hold"}
                      </span>

                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-slate-200 bg-black/60 backdrop-blur-md border border-white/20">
                        ID: #{deleteModalCar.id?.slice(-8)}
                      </span>
                    </div>

                    {/* Bottom Title & Valuation Overlay */}
                    <div className="absolute bottom-3 inset-x-4 flex flex-col sm:flex-row sm:items-end justify-between gap-1 text-white">
                      <div>
                        <h4 className="text-xl font-bold capitalize drop-shadow-md tracking-tight">
                          {deleteModalCar.title}
                        </h4>
                        <p className="text-xs text-slate-300 font-mono mt-0.5">
                          {deleteModalCar.year} • {deleteModalCar.city} • {deleteModalCar.mileage}
                        </p>
                      </div>
                      <div className="text-right sm:text-right">
                        <div className="text-xl font-extrabold font-mono text-emerald-400 drop-shadow-md">
                          {deleteModalCar.priceFormatted}
                        </div>
                        <div className="text-[10px] text-slate-300 font-mono">
                          Valuation Record
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3-Column Detailed Vehicle Specs Pill Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046]">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block">Seller Information</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-200 block truncate mt-0.5">
                        {deleteModalCar.seller?.name || "Private Seller"}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate block">
                        {deleteModalCar.seller?.phoneNumber || deleteModalCar.seller?.email || "shoaib@test.com"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046]">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block">Specs & Fuel</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-200 block truncate mt-0.5">
                        {deleteModalCar.fuel} • {deleteModalCar.transmission}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate block capitalize">
                        {deleteModalCar.bodyType || "Sedan"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046]">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block">Registration Region</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-200 block truncate mt-0.5 capitalize">
                        {deleteModalCar.city}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 truncate block">
                        Excise Verified Node
                      </span>
                    </div>
                  </div>
                </div>

                {/* Permanent Purge Warning */}
                <div className="p-3.5 rounded-xl bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/25 dark:border-rose-900/60 flex items-start gap-3">
                  <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-[22px] mt-0.5 shrink-0">
                    warning
                  </span>
                  <div className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                    <strong>Critical Confirmation:</strong> You are about to permanently delete this vehicle entity from the MongoDB database. The car will be purged immediately from the live marketplace, public search indexes, and buyer favorite collections. <strong>This action cannot be undone.</strong>
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#263046] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                    <span className="material-symbols-outlined text-[15px] text-rose-500">
                      security
                    </span>
                    Admin Superuser Verification Required
                  </div>

                  <div className="flex items-center gap-2.5 justify-end">
                    <button
                      type="button"
                      disabled={processingCarId === deleteModalCar.id}
                      onClick={() => setDeleteModalCar(null)}
                      className="h-10 px-4 rounded-lg bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-[#263046] hover:bg-slate-200 dark:hover:bg-[#25334a] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-semibold"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={processingCarId === deleteModalCar.id}
                      onClick={handleConfirmDeleteByAdmin}
                      className="h-10 px-5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all text-xs font-semibold flex items-center gap-2 shadow-md shadow-rose-900/40 disabled:opacity-50"
                    >
                      {processingCarId === deleteModalCar.id ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">
                            progress_activity
                          </span>
                          Purging from Database...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                          Permanently Delete Vehicle
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Operational Footer Metrics */}
          <div className="py-4 border-t border-slate-200 dark:border-[#263046] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span>AutoBazaar Trust & Safety System</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400">Database Sync Active</span>
            </div>
            <div>Admin Console Active</div>
            <div>Admin Console Active</div>
          </div>

        </main>
      </div>
    </div>
  );
}
