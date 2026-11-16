import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBuyerDashboard } from "../api/buyerDashboard.api";

export default function BuyerDashboardPage({ onOpenAuth, favorites = new Set(), onToggleFavorite }) {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    buyerProfile: null,
    stats: {
      activeInquiries: 0,
      newReplies: 0,
      totalAppointments: 0,
      upcomingAppointments: 0,
      savedCars: 0,
      avgInspectionScore: "9.2",
    },
    counts: { all: 0, inquiries: 0, appointments: 0, saved: 0 },
    records: [],
    inquiries: [],
    appointments: [],
    savedCars: [],
    recommendedCars: [],
  });

  const [mainTab, setMainTab] = useState("all"); // 'inquiries' | 'appointments' | 'saved' | 'all'
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'accepted' | 'requested' | 'completed' | 'cancelled'
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchDashboard() {
      try {
        setLoading(true);
        const res = await getBuyerDashboard();
        if (isMounted && res) {
          setData({
            buyerProfile: res.buyerProfile || null,
            stats: {
              activeInquiries: res.stats?.activeInquiries ?? 0,
              newReplies: res.stats?.newReplies ?? 0,
              totalAppointments: res.stats?.totalAppointments ?? 0,
              upcomingAppointments: res.stats?.upcomingAppointments ?? 0,
              savedCars: res.stats?.savedCars ?? 0,
              avgInspectionScore: res.stats?.avgInspectionScore ?? null,
              completedReportsCount: res.stats?.completedReportsCount ?? 0,
            },
            counts: {
              all: res.counts?.all ?? 0,
              inquiries: res.counts?.inquiries ?? 0,
              appointments: res.counts?.appointments ?? 0,
              saved: res.counts?.saved ?? 0,
            },
            records: res.records || [],
            inquiries: res.inquiries || [],
            appointments: res.appointments || [],
            savedCars: res.savedCars || [],
            recommendedCars: res.recommendedCars || [],
          });
        }
      } catch (err) {
        console.error("Failed to load buyer dashboard:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchDashboard();
    }
  }, [isAuthenticated, authLoading]);

  // Compute filtered list of records
  const filteredRecords = useMemo(() => {
    let sourceList = [];

    if (mainTab === "inquiries") {
      sourceList = data.inquiries || [];
    } else if (mainTab === "appointments") {
      sourceList = data.appointments || [];
    } else if (mainTab === "saved") {
      // Format savedCars as activity records
      sourceList = (data.savedCars || []).map((car) => ({
        id: car._id,
        category: "saved",
        type: "saved",
        title: car.title || `${car.year} ${car.make} ${car.model}`,
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price,
        image: car.images?.[0] || "",
        city: car.city || "Pakistan",
        subtitle: `${car.mileage?.toLocaleString() || ""} km • ${car.fuelType || "Petrol"}`,
        partnerName: car.seller?.name || "Verified Seller",
        partnerPhone: car.seller?.phoneNumber || "",
        contextText: "Saved in your garage wishlist",
        timeText: "Saved",
        status: "accepted",
        statusLabel: "Favorited",
        link: `/cars/${car._id}`,
        actionLabel: "View Listing",
        actionIcon: "visibility",
        carId: car._id,
      }));
    } else {
      sourceList = data.records || [];
    }

    // Filter by status
    if (statusFilter !== "all") {
      sourceList = sourceList.filter((item) => {
        if (statusFilter === "accepted") return item.status === "accepted";
        if (statusFilter === "requested") return item.status === "requested" || item.status === "scheduled";
        if (statusFilter === "completed") return item.status === "completed";
        if (statusFilter === "cancelled") return item.status === "cancelled" || item.status === "rejected";
        return true;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      sourceList = sourceList.filter((item) =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.city && item.city.toLowerCase().includes(q)) ||
        (item.partnerName && item.partnerName.toLowerCase().includes(q))
      );
    }

    return sourceList;
  }, [mainTab, statusFilter, searchQuery, data]);

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">dashboard</span>
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-2">Sign in to Access Buyer Dashboard</h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Track all your car negotiations, seller chats, 200-point inspection appointments, and saved vehicles in one personalized command center.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow hover:opacity-90 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">login</span>
          Sign In / Register
        </button>
      </div>
    );
  }

  const profile = data.buyerProfile || {
    name: user?.name || "Ahmed Raza",
    phone: user?.phoneNumber || "+92 300 1234567",
    city: user?.city || "Karachi",
    buyerIdCode: `PK-${String(user?._id || "88219").slice(-5).toUpperCase()}`,
  };

  const initials = profile.name
    ? profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AB";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#0B0F1A] text-on-surface dark:text-[#E6EAF2] pt-6 pb-20">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 flex flex-col gap-6">
        
        {/* Top Hero / Summary Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-outline-variant/30 dark:border-[#1E2638]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface dark:text-[#E6EAF2]">
                Buyer Dashboard
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-[#818CF8] text-xs font-semibold border border-primary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                Verified PakBuyer ID: {profile.buyerIdCode}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] max-w-2xl leading-relaxed">
              Track your car inquiries, inspection bookings, and seller communications across {profile.city}, Lahore, Karachi, and Islamabad.
            </p>
          </div>

          {/* Action & Profile Summary Card */}
          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-surface-container-low dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] shadow-sm">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface dark:text-[#E6EAF2] leading-tight">
                  {profile.name}
                </span>
                <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8] leading-tight">
                  {profile.phone || profile.city}
                </span>
              </div>
            </div>

            <Link
              to="/cars"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs shadow transition-all whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[17px]">directions_car</span>
              Browse Used Cars
            </Link>
          </div>
        </div>

        {/* 4 KPI Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stat 1: Inquiries */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] shadow-sm flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8] uppercase tracking-wider font-semibold">
                Active Inquiries
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-on-surface dark:text-[#E6EAF2]">
                  {data.stats.activeInquiries}
                </span>
                {data.stats.newReplies > 0 ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {data.stats.newReplies} new reply
                  </span>
                ) : (
                  <span className="text-xs text-on-surface-variant dark:text-[#94A3B8]">
                    In chat
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/50 text-[#6366F1] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">forum</span>
            </div>
          </div>

          {/* Stat 2: Appointments */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] shadow-sm flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8] uppercase tracking-wider font-semibold">
                Appointments
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-on-surface dark:text-[#E6EAF2]">
                  {data.stats.totalAppointments}
                </span>
                <span className="text-xs text-on-surface-variant dark:text-[#94A3B8]">
                  {data.stats.upcomingAppointments} upcoming
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">event_available</span>
            </div>
          </div>

          {/* Stat 3: Saved Cars */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] shadow-sm flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8] uppercase tracking-wider font-semibold">
                Saved in Garage
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-on-surface dark:text-[#E6EAF2]">
                  {data.stats.savedCars}
                </span>
                <span className="text-xs text-on-surface-variant dark:text-[#94A3B8]">
                  Price drop alerts
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">favorite</span>
            </div>
          </div>

          {/* Stat 4: Inspection AVG Score */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] shadow-sm flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8] uppercase tracking-wider font-semibold">
                Inspection Score AVG
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-on-surface dark:text-[#E6EAF2]">
                  {data.stats?.avgInspectionScore ? (
                    <>
                      {data.stats.avgInspectionScore}
                      <span className="text-xs font-normal text-on-surface-variant dark:text-[#94A3B8]">/10</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-xs text-on-surface-variant dark:text-[#94A3B8]">
                  {data.stats?.completedReportsCount > 0
                    ? `${data.stats.completedReportsCount} completed`
                    : "No reports yet"}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-950/50 text-sky-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">verified</span>
            </div>
          </div>
        </div>

        {/* Segmented Tabs & Filters Section */}
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Segmented Tab Switcher */}
            <div className="inline-flex p-1 rounded-xl bg-surface-container-low dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] max-w-fit shadow-sm overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setMainTab("inquiries")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                  mainTab === "inquiries"
                    ? "bg-surface-container-lowest dark:bg-[#1E2638] text-[#4F46E5] dark:text-white shadow-sm"
                    : "text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
                Inquiries
                <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary dark:text-[#818CF8] text-[10px] font-bold">
                  {data.counts.inquiries || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab("appointments")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                  mainTab === "appointments"
                    ? "bg-surface-container-lowest dark:bg-[#1E2638] text-[#4F46E5] dark:text-white shadow-sm"
                    : "text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                Appointments
                <span className="px-1.5 py-0.2 rounded-full bg-surface-container dark:bg-[#263046] text-on-surface-variant dark:text-[#94A3B8] text-[10px] font-bold">
                  {data.counts.appointments || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab("saved")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                  mainTab === "saved"
                    ? "bg-surface-container-lowest dark:bg-[#1E2638] text-[#4F46E5] dark:text-white shadow-sm"
                    : "text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">bookmark_heart</span>
                Saved Watchlist
                <span className="px-1.5 py-0.2 rounded-full bg-surface-container dark:bg-[#263046] text-on-surface-variant dark:text-[#94A3B8] text-[10px] font-bold">
                  {data.counts.saved || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab("all")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                  mainTab === "all"
                    ? "bg-surface-container-lowest dark:bg-[#1E2638] text-[#4F46E5] dark:text-white shadow-sm"
                    : "text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
                }`}
              >
                All Records
                <span className="px-1.5 py-0.2 rounded-full bg-surface-container dark:bg-[#263046] text-on-surface-variant dark:text-[#94A3B8] text-[10px] font-bold">
                  {data.counts.all || 0}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-[#94A3B8] text-[17px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search car, city or seller..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] text-xs text-on-surface dark:text-[#E6EAF2] placeholder:text-on-surface-variant dark:placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
              />
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-nowrap">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                statusFilter === "all"
                  ? "bg-[#4F46E5] text-white shadow-sm"
                  : "bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
              }`}
            >
              All Statuses
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("accepted")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "accepted"
                  ? "bg-[#4F46E5] text-white shadow-sm"
                  : "bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Accepted / Active
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("requested")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "requested"
                  ? "bg-[#4F46E5] text-white shadow-sm"
                  : "bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Scheduled / Requested
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "completed"
                  ? "bg-[#4F46E5] text-white shadow-sm"
                  : "bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Completed
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("cancelled")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "cancelled"
                  ? "bg-[#4F46E5] text-white shadow-sm"
                  : "bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Cancelled / Declined
            </button>
          </div>
        </div>

        {/* Activity Records List */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl animate-spin text-primary mb-3">
                progress_activity
              </span>
              <p className="text-sm font-medium">Loading your buyer records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 px-6 bg-surface-container-lowest dark:bg-[#121826] rounded-2xl border border-outline-variant/30 dark:border-[#1E2638] text-center flex flex-col items-center justify-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-surface-container dark:bg-[#1A2132] flex items-center justify-center text-on-surface-variant dark:text-[#94A3B8] mb-3">
                <span className="material-symbols-outlined text-3xl">search_off</span>
              </div>
              <h3 className="text-base font-bold text-on-surface dark:text-[#E6EAF2] mb-1">
                No matching records found
              </h3>
              <p className="text-xs text-on-surface-variant dark:text-[#94A3B8] max-w-sm">
                {searchQuery
                  ? "No vehicle inquiries or appointments match your search terms."
                  : mainTab === "inquiries"
                  ? "You haven't messaged any car sellers yet. Browse used cars and reach out to dealers!"
                  : mainTab === "appointments"
                  ? "No doorstep inspection appointments scheduled. Book a 200-point inspection before buying!"
                  : "Save cars or initiate inquiries to track your buying deals here."}
              </p>
              <Link
                to="/cars"
                className="mt-4 px-4 py-2 rounded-xl bg-surface-container-high dark:bg-[#1E2638] text-on-surface dark:text-white text-xs font-semibold hover:bg-surface-container transition-colors"
              >
                Find Cars to Inquire
              </Link>
            </div>
          ) : (
            filteredRecords.map((item) => {
              // Status pill styling
              let pillBg = "bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
              let dotColor = "bg-emerald-500";

              if (item.status === "requested" || item.status === "scheduled") {
                pillBg = "bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-500/20";
                dotColor = "bg-amber-500 animate-pulse";
              } else if (item.status === "completed") {
                pillBg = "bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-500/20";
                dotColor = "bg-blue-500";
              } else if (item.status === "cancelled" || item.status === "rejected") {
                pillBg = "bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-500/20";
                dotColor = "bg-rose-500";
              }

              return (
                <div
                  key={`${item.category}-${item.id}`}
                  className="group p-4 sm:p-5 rounded-2xl bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] hover:border-outline-variant/60 dark:hover:border-[#263046] transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <div className="relative w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container dark:bg-[#1A2132] border border-outline-variant/20 dark:border-[#263046]">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl">directions_car</span>
                        </div>
                      )}
                      {item.subtitle && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-white font-semibold leading-tight">
                          {item.subtitle}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0 gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm sm:text-base text-on-surface dark:text-[#E6EAF2] group-hover:text-primary dark:group-hover:text-white transition-colors truncate">
                          {item.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant dark:text-[#94A3B8] flex-wrap">
                        <span className="text-primary dark:text-[#818CF8] font-bold">
                          PKR {Number(item.price || 0).toLocaleString()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          {item.city}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-on-surface-variant dark:text-[#94A3B8] text-[11px] mt-0.5 flex-wrap">
                        <span className="font-semibold text-on-surface dark:text-white">
                          {item.partnerName}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-primary dark:text-[#818CF8]">
                          <span className="material-symbols-outlined text-[13px]">
                            {item.category === "inquiries" ? "chat" : "calendar_month"}
                          </span>
                          {item.contextText}
                        </span>
                        <span>•</span>
                        <span>{item.timeText}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Pill & Action CTA */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-outline-variant/20 dark:border-[#1E2638]">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${pillBg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                      {item.statusLabel || "Active"}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(item.link)}
                      className="px-4 py-2 rounded-xl bg-surface-container dark:bg-[#1A2132] hover:bg-surface-container-high dark:hover:bg-[#263046] text-on-surface dark:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm border border-outline-variant/30 dark:border-[#263046]"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary dark:text-[#818CF8]">
                        {item.actionIcon}
                      </span>
                      {item.actionLabel}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Personalized Recommendations Row */}
        {data.recommendedCars && data.recommendedCars.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-on-surface dark:text-white tracking-tight">
                  Recommended For You in {profile.city}
                </h2>
                <p className="text-xs text-on-surface-variant dark:text-[#94A3B8]">
                  Hand-picked certified vehicles matching your location and budget interests.
                </p>
              </div>
              <Link
                to={`/cars?city=${encodeURIComponent(profile.city)}`}
                className="text-xs font-semibold text-primary dark:text-[#818CF8] hover:underline flex items-center gap-1"
              >
                View all in {profile.city} →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.recommendedCars.slice(0, 4).map((car) => {
                const isFav = favorites.has(car._id);
                return (
                  <div
                    key={car._id}
                    onClick={() => navigate(`/cars/${car._id}`)}
                    className="group cursor-pointer rounded-2xl bg-surface-container-lowest dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] hover:border-primary/50 overflow-hidden shadow-sm flex flex-col transition-all"
                  >
                    <div className="relative w-full h-36 bg-surface-container dark:bg-[#1A2132] overflow-hidden">
                      {car.images?.[0] ? (
                        <img
                          src={car.images[0]}
                          alt={car.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-4xl">directions_car</span>
                        </div>
                      )}
                      {onToggleFavorite && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(car._id);
                          }}
                          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                            isFav ? "bg-rose-500 text-white" : "bg-black/40 text-white hover:bg-black/60"
                          }`}
                        >
                          <span
                            className="material-symbols-outlined text-[18px]"
                            style={isFav ? { fontVariationSettings: "'FILL' 1" } : undefined}
                          >
                            favorite
                          </span>
                        </button>
                      )}
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white">
                        {car.city || profile.city}
                      </span>
                    </div>

                    <div className="p-3.5 flex flex-col gap-1 flex-1">
                      <h4 className="font-bold text-xs sm:text-sm text-on-surface dark:text-[#E6EAF2] group-hover:text-primary dark:group-hover:text-white transition-colors truncate">
                        {car.title || `${car.year} ${car.make} ${car.model}`}
                      </h4>
                      <div className="text-[11px] text-on-surface-variant dark:text-[#94A3B8]">
                        {car.mileage?.toLocaleString() || "24,000"} km • {car.transmission || "Automatic"}
                      </div>
                      <div className="mt-auto pt-2 flex items-center justify-between">
                        <span className="font-bold text-sm text-primary dark:text-[#818CF8]">
                          PKR {Number(car.price || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                          Verified
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Context Banner: Safe-Trade Guarantee */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-low dark:bg-[#121826] border border-outline-variant/30 dark:border-[#1E2638] flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 shadow-sm">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-bold text-on-surface dark:text-[#E6EAF2]">
                AutoBazaar Buyer Safe-Trade Guarantee
              </span>
              <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
                Every verified appointment includes doorstep biometric verification and free computerized token verification support across Pakistan.
              </span>
            </div>
          </div>
          <Link
            to="/inspections"
            className="px-4 py-2 rounded-xl bg-surface-container-lowest dark:bg-[#1E2638] hover:bg-surface-container dark:hover:bg-[#263046] text-on-surface dark:text-white text-xs font-semibold self-start sm:self-auto transition-colors whitespace-nowrap shadow-sm border border-outline-variant/30 dark:border-[#263046]"
          >
            Learn Inspection Policy →
          </Link>
        </div>

      </div>
    </div>
  );
}

