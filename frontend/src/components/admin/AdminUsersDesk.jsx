import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  getAllPlatformUsers,
  updateUserRole,
  updateUserStatus,
  deleteUserAccountByAdmin,
} from "../../api/admin.api";

export default function AdminUsersDesk({ currentAdminId = "" }) {
  // Data state
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    sellersCount: 0,
    buyersCount: 0,
    suspendedCount: 0,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 20,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackNotice, setFeedbackNotice] = useState("");

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTabFilter, setActiveTabFilter] = useState("all"); // 'all' | 'sellers' | 'buyers' | 'suspended'
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());

  // Modal states
  const [manageModalUser, setManageModalUser] = useState(null);
  const [modalMode, setModalMode] = useState("manage"); // 'manage' | 'suspend' | 'delete'
  const [selectedRole, setSelectedRole] = useState("buyer");
  const [violationCategory, setViolationCategory] = useState("Document / VIN Discrepancy");
  const [internalNote, setInternalNote] = useState("");
  const [delistVehiclesToggle, setDelistVehiclesToggle] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Fetch users from backend API
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      let roleParam = roleFilter !== "all" ? roleFilter : "";
      if (activeTabFilter === "sellers") roleParam = "seller";
      else if (activeTabFilter === "buyers") roleParam = "buyer";

      let statusParam = statusFilter !== "all" ? statusFilter : "";
      if (activeTabFilter === "suspended") statusParam = "suspended";

      const data = await getAllPlatformUsers({
        role: roleParam,
        status: statusParam,
        search: searchTerm,
        page: pagination.page,
        limit: pagination.limit,
      });

      setUsers(data.users || []);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setFeedbackNotice("Failed to load users from database");
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, activeTabFilter, roleFilter, statusFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  // Handle open Manage / Suspend Modal
  const openManageModal = (user, mode = "manage") => {
    setManageModalUser(user);
    setModalMode(mode);
    setSelectedRole(user.role || "buyer");
    setViolationCategory("Document / VIN Discrepancy");
    setInternalNote(
      user.suspensionReason ||
        (mode === "suspend"
          ? "Administrative review flag placed by Platform Administrator."
          : "")
    );
    setDelistVehiclesToggle(true);
  };

  const closeManageModal = () => {
    setManageModalUser(null);
    setIsSubmittingAction(false);
  };

  // Submit Role Change
  const handleSaveRole = async () => {
    if (!manageModalUser) return;
    try {
      setIsSubmittingAction(true);
      await updateUserRole(manageModalUser._id || manageModalUser.id, selectedRole);
      setFeedbackNotice(`Role updated for ${manageModalUser.name} to ${selectedRole.toUpperCase()}`);
      closeManageModal();
      await fetchUsers();
      setTimeout(() => setFeedbackNotice(""), 4000);
    } catch (err) {
      console.error("Failed to update role:", err);
      alert(err.response?.data?.message || "Failed to update role");
      setIsSubmittingAction(false);
    }
  };

  // Submit Suspension / Reactivation
  const handleToggleSuspension = async (newStatus) => {
    if (!manageModalUser) return;
    try {
      setIsSubmittingAction(true);
      await updateUserStatus(manageModalUser._id || manageModalUser.id, {
        status: newStatus,
        reason: internalNote || violationCategory,
        delistVehicles: delistVehiclesToggle,
      });
      setFeedbackNotice(
        `Account for ${manageModalUser.name} has been ${
          newStatus === "suspended" ? "suspended" : "reactivated"
        }`
      );
      closeManageModal();
      await fetchUsers();
      setTimeout(() => setFeedbackNotice(""), 4000);
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(err.response?.data?.message || "Failed to update user status");
      setIsSubmittingAction(false);
    }
  };

  // Submit Permanent Account Deletion
  const handleDeleteUser = async () => {
    if (!manageModalUser) return;
    try {
      setIsSubmittingAction(true);
      await deleteUserAccountByAdmin(manageModalUser._id || manageModalUser.id);
      setFeedbackNotice(`User account ${manageModalUser.name} and listings permanently deleted.`);
      closeManageModal();
      await fetchUsers();
      setTimeout(() => setFeedbackNotice(""), 4000);
    } catch (err) {
      console.error("Failed to delete user:", err);
      alert(err.response?.data?.message || "Failed to delete user account");
      setIsSubmittingAction(false);
    }
  };

  // Batch Select Toggle
  const toggleSelectUser = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map((u) => u._id || u.id)));
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = "ID,Name,Email,Role,Phone,Status,Active Listings,Total Volume (PKR),Joined Date\n";
    const rows = users
      .map((u) => {
        const id = u._id || u.id;
        const name = `"${u.name.replace(/"/g, '""')}"`;
        const email = u.email;
        const role = u.role;
        const phone = `"${u.phoneNumber || ""}"`;
        const status = u.status || "active";
        const listings = u.activeListings || 0;
        const volume = u.totalVolumePkr || 0;
        const joined = u.createdAt ? new Date(u.createdAt).toISOString() : "";
        return `${id},${name},${email},${role},${phone},${status},${listings},${volume},${joined}`;
      })
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autobazaar_users_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper for Initials
  const getInitials = (name = "") => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || "UB";
  };

  // Format currency helper
  const formatPkrShort = (amount = 0) => {
    if (!amount) return "PKR 0";
    if (amount >= 10000000) return `PKR ${(amount / 10000000).toFixed(1)} Cr`;
    if (amount >= 100000) return `PKR ${(amount / 100000).toFixed(1)} Lac`;
    return `PKR ${amount.toLocaleString("en-PK")}`;
  };

  return (
    <div className="flex flex-col w-full text-slate-800 dark:text-slate-200">
      
      {/* Toast Feedback Notification */}
      {feedbackNotice && (
        <div className="mb-4 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-800 dark:text-indigo-200 text-xs font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600 dark:text-indigo-400">
              check_circle
            </span>
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice("")}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Sub-header Breadcrumb & Operational Mode Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#263046]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              ADMIN CONSOLE
            </span>
            <span>/</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold tracking-wide">
              USER REGISTRY &amp; KYC DESK
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2]">
              User Registry &amp; Verification Desk
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
              Live Database Active
            </span>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchUsers}
            className="h-9 px-3 rounded-lg bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] hover:bg-slate-100 dark:hover:bg-[#161F30] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm"
          >
            <span className={`material-symbols-outlined text-[17px] text-slate-500 dark:text-slate-400 ${isLoading ? "animate-spin" : ""}`}>
              refresh
            </span>
            Sync
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3 rounded-lg bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] hover:bg-slate-100 dark:hover:bg-[#161F30] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[17px] text-slate-500 dark:text-slate-400">
              file_download
            </span>
            Export CSV
          </button>
        </div>
      </div>

      {/* 1. Top KPI Summary Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-6">
        
        {/* Card 1: Total Users */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">
              Total Users
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] flex items-center justify-center text-slate-700 dark:text-slate-300">
              <span className="material-symbols-outlined text-[16px]">groups</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2] font-mono">
              {metrics.totalUsers}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined text-[14px]">verified_user</span>
                100% real
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                registered in MongoDB
              </span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 2: Active Sellers & Dealers */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">
              Sellers &amp; Dealers
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-[#162238] border border-indigo-200 dark:border-[#233555] flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              <span className="material-symbols-outlined text-[16px]">storefront</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2] font-mono">
              {metrics.sellersCount}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-medium">
                Authorized Sellers
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                can list vehicles
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Buyers */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">
              Registered Buyers
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-[#182334] border border-blue-200 dark:border-[#283852] flex items-center justify-center text-blue-600 dark:text-blue-300">
              <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E6EAF2] font-mono">
              {metrics.buyersCount}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>Can message &amp; submit car inquiries</span>
            </div>
          </div>
        </div>

        {/* Card 4: Suspended / Staff */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">
              Suspended Accounts
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-[#2A161E] border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <span className="material-symbols-outlined text-[16px]">gavel</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
              {metrics.suspendedCount}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>
                {metrics.suspendedCount > 0
                  ? "Accounts under restriction"
                  : "0 restricted accounts"}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Action & Filter Toolbar */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col gap-3.5 shadow-sm">
        
        {/* Row 1: Search & Filter Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name, phone (+92), or email..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-xs text-slate-900 dark:text-[#E6EAF2] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Segmented Status Tabs */}
          <div className="flex items-center overflow-x-auto scrollbar-none bg-slate-100 dark:bg-[#0B0F1A] p-1 rounded-lg border border-slate-200 dark:border-[#263046] text-xs">
            <button
              type="button"
              onClick={() => setActiveTabFilter("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTabFilter === "all"
                  ? "bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white border border-slate-200 dark:border-[#32405D] shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>All</span>
              <span className="text-[10px] font-mono px-1 rounded bg-slate-200 dark:bg-[#0B0F1A]">
                {metrics.totalUsers}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabFilter("sellers")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTabFilter === "sellers"
                  ? "bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white border border-slate-200 dark:border-[#32405D] shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>Sellers &amp; Dealers</span>
              <span className="text-[10px] font-mono px-1 rounded bg-slate-200 dark:bg-[#121826]">
                {metrics.sellersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabFilter("buyers")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTabFilter === "buyers"
                  ? "bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white border border-slate-200 dark:border-[#32405D] shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>Buyers</span>
              <span className="text-[10px] font-mono px-1 rounded bg-slate-200 dark:bg-[#121826]">
                {metrics.buyersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabFilter("suspended")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTabFilter === "suspended"
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-sm"
                  : "text-rose-500/80 hover:text-rose-600 dark:hover:text-rose-300"
              }`}
            >
              <span>Suspended</span>
              <span className="text-[10px] font-mono px-1 rounded bg-rose-100 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40">
                {metrics.suspendedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Dropdowns & Fast Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-[#1C263A] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Role Dropdown */}
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="appearance-none h-8 pl-2.5 pr-7 rounded bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Role: All Roles</option>
                <option value="seller">Seller / Dealer</option>
                <option value="buyer">Buyer</option>
              </select>
              <span className="material-symbols-outlined absolute right-1.5 top-2 text-slate-400 text-[16px] pointer-events-none">
                expand_more
              </span>
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none h-8 pl-2.5 pr-7 rounded bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Status: All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
              <span className="material-symbols-outlined absolute right-1.5 top-2 text-slate-400 text-[16px] pointer-events-none">
                expand_more
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setActiveTabFilter("all");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
              className="h-8 px-2.5 rounded bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
            <span>
              {selectedUserIds.size > 0
                ? `${selectedUserIds.size} user${selectedUserIds.size > 1 ? "s" : ""} selected`
                : `${users.length} live records`}
            </span>
            {selectedUserIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedUserIds(new Set())}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1A2234] border border-slate-200 dark:border-[#263046] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 3. Searchable Users Table */}
      <div className="my-5 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            
            {/* Table Header */}
            <thead className="bg-slate-50 dark:bg-[#0D1322] border-b border-slate-200 dark:border-[#263046] text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUserIds.size === users.length}
                    onChange={toggleSelectAll}
                    className="rounded bg-white dark:bg-[#0B0F1A] border-slate-300 dark:border-[#263046] text-indigo-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                  />
                </th>
                <th className="py-3 px-3">User &amp; Contact Details</th>
                <th className="py-3 px-3">Role &amp; Verification</th>
                <th className="py-3 px-3">Inventory / Volume</th>
                <th className="py-3 px-3">Account Status</th>
                <th className="py-3 px-3">Member Since</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 dark:divide-[#1C263A]">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-[28px] animate-spin text-indigo-500 mb-2">
                      progress_activity
                    </span>
                    <p className="text-xs font-mono">Loading user accounts from database...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-[32px] text-slate-400 mb-2">
                      person_search
                    </span>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No users found</p>
                    <p className="text-xs text-slate-400 mt-1">Try modifying your search or filter criteria.</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const userId = user._id || user.id;
                  const isSelected = selectedUserIds.has(userId);
                  const isSuspended = user.status === "suspended";
                  const isSeller = user.role === "seller";

                  return (
                    <tr
                      key={userId}
                      className={`hover:bg-slate-50 dark:hover:bg-[#161F30]/60 transition-colors group ${
                        isSuspended ? "bg-rose-50/40 dark:bg-rose-950/10" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(userId)}
                          className="rounded bg-white dark:bg-[#0B0F1A] border-slate-300 dark:border-[#263046] text-indigo-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                        />
                      </td>

                      {/* User & Contact Details */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            isSeller
                              ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          }`}>
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isSeller && (
                                <span className="material-symbols-outlined text-[14px] text-indigo-500 dark:text-indigo-400" title="Verified Seller">
                                  verified
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {user.email}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[12px]">phone</span>
                              <span>{user.phoneNumber || "No phone registered"}</span>
                              {user.city && (
                                <>
                                  <span>•</span>
                                  <span>{user.city}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Verification */}
                      <td className="py-3.5 px-3">
                        {isSeller ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300">
                            <span className="material-symbols-outlined text-[13px]">storefront</span>
                            Seller / Dealer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-[#182334] border border-slate-200 dark:border-[#283852] text-slate-600 dark:text-slate-300">
                            <span className="material-symbols-outlined text-[13px]">shopping_cart</span>
                            Buyer
                          </span>
                        )}
                      </td>

                      {/* Inventory / Volume */}
                      <td className="py-3.5 px-3">
                        {user.totalListings > 0 ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-200">
                              {user.activeListings} Active Listing{user.activeListings !== 1 ? "s" : ""}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              Total: {formatPkrShort(user.totalVolumePkr)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                              0 listings
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-3">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        )}
                      </td>

                      {/* Member Since */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "N/A"}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openManageModal(user, "manage")}
                            className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] hover:bg-slate-200 dark:hover:bg-[#1E293B] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-medium"
                          >
                            Manage
                          </button>

                          <button
                            type="button"
                            onClick={() => openManageModal(user, isSuspended ? "manage" : "suspend")}
                            className={`px-2 py-1 rounded border transition-colors text-xs font-medium ${
                              isSuspended
                                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                            }`}
                            title={isSuspended ? "Reactivate Account" : "Suspend Account"}
                          >
                            {isSuspended ? "Reactivate" : "Suspend"}
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

        {/* Table Pagination */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-[#0D1322] border-t border-slate-200 dark:border-[#263046] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Showing <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{users.length}</span> of{" "}
            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{pagination.total}</span> users
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="h-8 px-2.5 rounded bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              <span>Prev</span>
            </button>
            <span className="px-3 py-1 rounded bg-[#6366F1] text-white font-medium text-xs shadow-sm">
              Page {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="h-8 px-2.5 rounded bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <span>Next</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>

      </div>

      {/* 4. Manage / Suspend Modal */}
      {manageModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] shadow-2xl p-6 overflow-hidden">
            
            {/* Top Decorative Accent */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
              modalMode === "suspend"
                ? "from-rose-500 via-amber-500 to-rose-600"
                : "from-indigo-500 via-purple-500 to-emerald-500"
            }`}></div>

            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-[#263046]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  modalMode === "suspend"
                    ? "bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-400"
                    : "bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400"
                }`}>
                  <span className="material-symbols-outlined text-[24px]">
                    {modalMode === "suspend" ? "gavel" : "manage_accounts"}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[#E6EAF2]">
                    {modalMode === "suspend"
                      ? "Suspend User Account"
                      : `Manage User: ${manageModalUser.name}`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {modalMode === "suspend"
                      ? "Apply marketplace trade restriction & audit sanction"
                      : "Configure account permissions, role, and operational standing"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeManageModal}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Target User Snippet Card */}
            <div className="my-4 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-[#162032] border border-indigo-200 dark:border-[#263046] flex items-center justify-center font-bold text-xs text-indigo-700 dark:text-indigo-300">
                  {getInitials(manageModalUser.name)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{manageModalUser.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-mono">
                      ID: #{String(manageModalUser._id || manageModalUser.id).slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {manageModalUser.email} • {manageModalUser.phoneNumber || "No phone registered"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 text-indigo-700 dark:text-indigo-300 text-[11px] font-mono font-medium">
                  {manageModalUser.activeListings || 0} Active Listings
                </span>
              </div>
            </div>

            {/* Suspension Form (If modalMode === 'suspend') */}
            {modalMode === "suspend" ? (
              <div className="space-y-4 text-xs">
                {/* Reason Radio selection */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Violation Primary Category
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "Document / VIN Discrepancy",
                      "Odometer Rollback Violation",
                      "Escrow / Advance Scam Flag",
                      "Other Administrative Sanction",
                    ].map((cat) => (
                      <label
                        key={cat}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          violationCategory === cat
                            ? "bg-rose-50 dark:bg-rose-950/30 border-rose-400 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-medium"
                            : "bg-slate-50 dark:bg-[#0B0F1A] border-slate-200 dark:border-[#263046] text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="violationCategory"
                          checked={violationCategory === cat}
                          onChange={() => setViolationCategory(cat)}
                          className="text-rose-600 focus:ring-0"
                        />
                        <span>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Internal Audit Note */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Internal Audit Note &amp; Evidence Record
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Visible to Admins Only
                    </span>
                  </div>
                  <textarea
                    rows="3"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Document rationale, complainant report, or reason for suspension..."
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono"
                  ></textarea>
                </div>

                {/* Delist toggle */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-rose-500 text-[18px]">
                      remove_shopping_cart
                    </span>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-200">
                        Delist all vehicle listings posted by this seller
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Immediately moves car cards to suspended status
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={delistVehiclesToggle}
                    onChange={(e) => setDelistVehiclesToggle(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              /* Manage Form: Role update & standing */
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Account Role &amp; Permissions
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { role: "buyer", label: "Buyer / Inquirer", icon: "shopping_cart" },
                      { role: "seller", label: "Seller / Dealer", icon: "storefront" },
                    ].map((item) => (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => setSelectedRole(item.role)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          selectedRole === item.role
                            ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm"
                            : "bg-slate-50 dark:bg-[#0B0F1A] border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account Status Switch */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F1A] border border-slate-200 dark:border-[#263046] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      Current Standing:{" "}
                      <span className={manageModalUser.status === "suspended" ? "text-rose-500" : "text-emerald-500"}>
                        {manageModalUser.status === "suspended" ? "Suspended" : "Active"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {manageModalUser.status === "suspended"
                        ? "This user is currently blocked from marketplace transactions."
                        : "Account in good operational standing."}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleToggleSuspension(
                        manageModalUser.status === "suspended" ? "active" : "suspended"
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      manageModalUser.status === "suspended"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-rose-600 hover:bg-rose-700 text-white"
                    }`}
                  >
                    {manageModalUser.status === "suspended" ? "Reactivate Account" : "Suspend Account"}
                  </button>
                </div>

                {/* Danger Zone: Delete User */}
                <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-rose-700 dark:text-rose-400">
                      Permanent Account Removal
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Deletes user profile and cascades delete to all their car listings.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmittingAction}
                    onClick={handleDeleteUser}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-all"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons Footer */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#263046] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                <span className="material-symbols-outlined text-[15px] text-amber-500">
                  shield
                </span>
                <span>Action will be recorded in audit log</span>
              </div>
              
              <div className="flex items-center gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={closeManageModal}
                  className="h-9 px-4 rounded-lg bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-[#263046] hover:bg-slate-200 dark:hover:bg-[#25334a] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-medium"
                >
                  Cancel
                </button>

                {modalMode === "suspend" ? (
                  <button
                    type="button"
                    disabled={isSubmittingAction}
                    onClick={() => handleToggleSuspension("suspended")}
                    className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors text-xs font-medium flex items-center gap-1.5 shadow-sm shadow-rose-900/30 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[17px]">block</span>
                    <span>{isSubmittingAction ? "Processing..." : "Confirm Suspension"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmittingAction || selectedRole === manageModalUser.role}
                    onClick={handleSaveRole}
                    className="h-9 px-4 rounded-lg bg-[#6366F1] hover:bg-[#5558E6] text-white transition-colors text-xs font-medium flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[17px]">save</span>
                    <span>{isSubmittingAction ? "Saving..." : "Save Role Change"}</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

