import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getPublishedCars, getMyListings } from "../api/cars.api";
import {
  getInspectionOverview,
  getMyInspectionBookings,
  createInspectionBooking,
  cancelInspectionBooking,
  completeInspectionBooking,
} from "../api/inspections.api";
import { useAuth } from "../context/AuthContext";

const TIME_SLOTS = [
  "10:00 AM - 12:00 PM",
  "12:00 PM - 02:00 PM",
  "02:00 PM - 04:00 PM",
  "04:00 PM - 06:00 PM",
];

const PAINT_TONE_STYLES = {
  emerald: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  amber: {
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
  },
  rose: {
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    dot: "bg-rose-500",
  },
};

const RULE_TONE_STYLES = {
  emerald: {
    box: "bg-emerald-500/10 border-emerald-500/30",
    title: "text-emerald-700 dark:text-emerald-300",
    status: "text-emerald-700 dark:text-emerald-300",
  },
  neutral: {
    box: "bg-surface-container-low border-outline-variant/30",
    title: "text-on-surface",
    status: "text-primary",
  },
  rose: {
    box: "bg-rose-500/10 border-rose-500/25",
    title: "text-rose-700 dark:text-rose-300",
    status: "text-rose-700 dark:text-rose-300",
  },
};

const todayLocalISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function InspectionsPage({
  favorites = new Set(),
  onToggleFavorite,
  onOpenAuth,
}) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const requestedCarId = searchParams.get("carId") || "";

  // Database overview state
  const [overview, setOverview] = useState(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  // Checklist explorer state
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [checkpointQuery, setCheckpointQuery] = useState("");

  // Selectable vehicle options from MongoDB
  const [vehicleOptions, setVehicleOptions] = useState([]);

  // Booking form state
  const [bookingType, setBookingType] = useState("buyer_pre_purchase");
  const [selectedCarId, setSelectedCarId] = useState(requestedCarId || "custom");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [registrationCity, setRegistrationCity] = useState("");
  const [hubId, setHubId] = useState("");
  const [preferredDate, setPreferredDate] = useState(todayLocalISO);
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState(null); // { type: 'success' | 'error', text }

  // Bookings & Reports list state
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingScope, setBookingScope] = useState("mine"); // "mine" | "all" (admin)
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [processingBookingId, setProcessingBookingId] = useState(null);

  // Admin completion form state
  const [completingBooking, setCompletingBooking] = useState(null);
  const [scoreInput, setScoreInput] = useState("9.2");
  const [domainScoresInput, setDomainScoresInput] = useState({
    engine: "",
    chassis: "",
    suspension: "",
    interior: "",
    road: "",
    documents: "",
  });
  const [inspectorNotesInput, setInspectorNotesInput] = useState("");
  const [completeError, setCompleteError] = useState("");
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  // Load DB inspection overview + live vehicle choices
  const loadOverviewAndCars = useCallback(async () => {
    try {
      setIsLoadingOverview(true);
      setOverviewError("");

      const [overviewData, publishedRes, myListingsRes] = await Promise.all([
        getInspectionOverview(),
        getPublishedCars({ limit: 50 }).catch(() => []),
        isAuthenticated && (user?.role === "seller" || user?.role === "admin")
          ? getMyListings().catch(() => [])
          : Promise.resolve([]),
      ]);

      setOverview(overviewData);

      const domains = overviewData?.standard?.domains || [];
      setSelectedDomainId((prev) => prev || domains[0]?.id || "");

      const hubs = overviewData?.hubs || [];
      setHubId((prev) => prev || hubs[0]?._id || "");

      // Combine published listings and seller's own cars without duplicates
      const seenIds = new Set();
      const mergedVehicles = [];
      for (const car of [...(myListingsRes || []), ...(publishedRes || [])]) {
        if (!car?.id || seenIds.has(car.id)) continue;
        if (car.status === "sold" || car.status === "rejected") continue;
        seenIds.add(car.id);
        mergedVehicles.push(car);
      }
      setVehicleOptions(mergedVehicles);
    } catch (err) {
      setOverviewError(
        err.message || "Unable to load inspection data from database."
      );
    } finally {
      setIsLoadingOverview(false);
    }
  }, [isAuthenticated, user?.role]);

  // Load authenticated user's (or admin's) bookings & reports from MongoDB
  const loadBookings = useCallback(async () => {
    if (!isAuthenticated) {
      setBookings([]);
      return;
    }
    try {
      setIsLoadingBookings(true);
      const list = await getMyInspectionBookings({
        scope: isAdmin && bookingScope === "all" ? "all" : undefined,
      });
      setBookings(list);
    } catch (err) {
      console.warn("Could not load inspection bookings:", err.message);
    } finally {
      setIsLoadingBookings(false);
    }
  }, [isAuthenticated, isAdmin, bookingScope]);

  useEffect(() => {
    loadOverviewAndCars();
  }, [loadOverviewAndCars]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    if (isAdmin) {
      setBookingScope("all");
    } else {
      setBookingScope("mine");
    }
  }, [isAdmin]);

  // Prefill contact phone from logged-in user profile if empty
  useEffect(() => {
    if (user?.phoneNumber && !contactPhone) {
      setContactPhone(user.phoneNumber);
    }
  }, [user?.phoneNumber, contactPhone]);

  // Preselect car from ?carId= query param and match city hub if available
  useEffect(() => {
    if (!requestedCarId) return;
    setSelectedCarId(requestedCarId);
    const matchedCar = vehicleOptions.find((c) => c.id === requestedCarId);
    if (matchedCar && overview?.hubs?.length) {
      const carCity = (matchedCar.city || "").toLowerCase().trim();
      const matchedHub = overview.hubs.find((h) =>
        (h.cityTags || [h.city.toLowerCase()]).some((t) => t.toLowerCase() === carCity)
      );
      if (matchedHub?._id) {
        setHubId(matchedHub._id);
      }
    }
  }, [requestedCarId, vehicleOptions, overview?.hubs]);

  // Scroll to booking section when navigated via #book-inspection, else scroll top
  useEffect(() => {
    if (location.hash === "#book-inspection") {
      const timer = setTimeout(() => {
        document.getElementById("book-inspection")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 150);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [location.hash]);

  const domains = useMemo(
    () => overview?.standard?.domains || [],
    [overview?.standard?.domains]
  );
  const paintScale = useMemo(
    () => overview?.standard?.paintScale || [],
    [overview?.standard?.paintScale]
  );
  const gradingRules = useMemo(
    () => overview?.standard?.gradingRules || [],
    [overview?.standard?.gradingRules]
  );
  const hubs = useMemo(() => overview?.hubs || [], [overview?.hubs]);
  const stats = overview?.stats || {};
  const featuredCars = overview?.featuredCars || [];
  const totalCheckpoints = overview?.totalCheckpoints || 0;

  const activeDomain = useMemo(
    () => domains.find((d) => d.id === selectedDomainId) || domains[0] || null,
    [domains, selectedDomainId]
  );

  const visibleCheckpoints = useMemo(() => {
    const q = checkpointQuery.trim().toLowerCase();
    if (!q) {
      return (activeDomain?.checks || []).map((c) => ({
        ...c,
        domainLabel: activeDomain?.label || "",
      }));
    }

    const matches = [];
    domains.forEach((domain) => {
      (domain.checks || []).forEach((c) => {
        if (
          c.name.toLowerCase().includes(q) ||
          c.tool.toLowerCase().includes(q) ||
          c.standard.toLowerCase().includes(q) ||
          domain.label.toLowerCase().includes(q)
        ) {
          matches.push({ ...c, domainLabel: domain.label });
        }
      });
    });
    return matches;
  }, [activeDomain, domains, checkpointQuery]);

  const selectedVehicleObj = useMemo(
    () =>
      selectedCarId !== "custom"
        ? vehicleOptions.find((c) => c.id === selectedCarId) || null
        : null,
    [selectedCarId, vehicleOptions]
  );

  const handleSelectHubAndScroll = (targetHubId) => {
    setHubId(targetHubId);
    document.getElementById("book-inspection")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleInspectCarShortcut = (car) => {
    setSelectedCarId(car.id);
    const carCity = (car.city || "").toLowerCase().trim();
    const matchedHub = hubs.find((h) =>
      (h.cityTags || [h.city.toLowerCase()]).some((t) => t.toLowerCase() === carCity)
    );
    if (matchedHub?._id) setHubId(matchedHub._id);
    document.getElementById("book-inspection")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingFeedback(null);

    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (!hubId) {
      setBookingFeedback({
        type: "error",
        text: "Please select an inspection hub center.",
      });
      return;
    }

    const isCustom = selectedCarId === "custom" || !selectedCarId;
    if (isCustom && (!vehicleLabel.trim() || !registrationCity.trim())) {
      setBookingFeedback({
        type: "error",
        text: "Please enter the vehicle description and city.",
      });
      return;
    }

    if (!contactPhone.trim()) {
      setBookingFeedback({
        type: "error",
        text: "Please provide a contact phone number.",
      });
      return;
    }

    try {
      setIsSubmittingBooking(true);
      const payload = {
        hubId,
        bookingType,
        contactPhone: contactPhone.trim(),
        preferredDate,
        timeSlot,
        notes: notes.trim(),
        ...(isCustom
          ? {
              vehicleLabel: vehicleLabel.trim(),
              registrationCity: registrationCity.trim(),
            }
          : {
              carId: selectedCarId,
            }),
      };

      const created = await createInspectionBooking(payload);
      setBookingFeedback({
        type: "success",
        text: `Appointment #${String(created._id).slice(-5).toUpperCase()} scheduled at ${
          created.hub?.city || "Hub"
        } center for ${created.vehicleLabel}.`,
      });
      setNotes("");
      if (isCustom) {
        setVehicleLabel("");
        setRegistrationCity("");
      }

      await Promise.all([loadBookings(), loadOverviewAndCars()]);
    } catch (err) {
      setBookingFeedback({
        type: "error",
        text: err.message || "Could not create inspection booking.",
      });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      setProcessingBookingId(bookingId);
      setBookingFeedback(null);
      await cancelInspectionBooking(bookingId);
      setBookingFeedback({
        type: "success",
        text: "Inspection appointment cancelled.",
      });
      await Promise.all([loadBookings(), loadOverviewAndCars()]);
    } catch (err) {
      setBookingFeedback({
        type: "error",
        text: err.message || "Could not cancel inspection booking.",
      });
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleOpenCompleteModal = (booking) => {
    setCompletingBooking(booking);
    setScoreInput("9.2");
    setDomainScoresInput({
      engine: "9.4",
      chassis: "9.3",
      suspension: "9.0",
      interior: "9.2",
      road: "9.1",
      documents: "9.5",
    });
    setInspectorNotesInput("");
    setCompleteError("");
  };

  const handleSubmitCompleteReport = async (e) => {
    e.preventDefault();
    if (!completingBooking) return;

    const numericScore = Number(scoreInput);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 10) {
      setCompleteError("Overall score must be between 0.0 and 10.0.");
      return;
    }

    const parsedDomainScores = {};
    for (const [k, v] of Object.entries(domainScoresInput)) {
      if (v !== "" && v !== null && v !== undefined) {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0 || n > 10) {
          setCompleteError(`Domain score for ${k} must be between 0.0 and 10.0.`);
          return;
        }
        parsedDomainScores[k] = n;
      }
    }

    try {
      setIsSubmittingComplete(true);
      setCompleteError("");
      const updated = await completeInspectionBooking(completingBooking._id, {
        score: numericScore,
        domainScores: parsedDomainScores,
        inspectorNotes: inspectorNotesInput.trim(),
      });

      setBookingFeedback({
        type: "success",
        text: `Official inspection score ${Number(updated.score).toFixed(1)}/10 (${
          updated.grade
        }) saved to MongoDB.`,
      });
      setCompletingBooking(null);
      setExpandedReportId(updated._id);
      await Promise.all([loadBookings(), loadOverviewAndCars()]);
    } catch (err) {
      setCompleteError(err.message || "Failed to save inspection report.");
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  if (isLoadingOverview) {
    return (
      <div className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-10 space-y-8 animate-pulse">
        <div className="h-64 rounded-3xl bg-surface-container-lowest border border-outline-variant/30" />
        <div className="h-12 w-72 rounded-xl bg-surface-container" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-36 rounded-2xl bg-surface-container-lowest border border-outline-variant/30"
            />
          ))}
        </div>
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <span className="material-symbols-outlined text-5xl text-error">
          cloud_off
        </span>
        <h1 className="text-2xl font-bold text-on-surface">
          Could Not Connect to Inspections Database
        </h1>
        <p className="text-sm text-on-surface-variant">
          {overviewError || "No inspection data could be retrieved from MongoDB."}
        </p>
        <button
          type="button"
          onClick={loadOverviewAndCars}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-95"
        >
          Retry Database Fetch
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Hero Banner */}
      <section className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin pt-8 md:pt-12 pb-8">
        <div className="relative overflow-hidden rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-lg p-6 sm:p-10 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold tracking-wide">
                <span className="material-symbols-outlined text-base">verified_user</span>
                {overview.standard?.title || `${totalCheckpoints}-Point Standard`}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface tracking-tight leading-tight">
                Buy Used Cars with Zero Mechanical or Paperwork Surprises
              </h1>

              <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
                Every vehicle approved for AutoBazaar certification undergoes ultrasonic paint-depth scanning, OEM OBD-II computer diagnostics, road evaluation, and provincial Excise &amp; Taxation verification with live results stored directly in our database.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#book-inspection"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-semibold text-xs sm:text-sm shadow-md hover:opacity-95 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">event_available</span>
                  Schedule Vehicle Inspection
                </a>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface font-semibold text-xs sm:text-sm transition-all"
                >
                  <span className="material-symbols-outlined text-lg text-primary">
                    directions_car
                  </span>
                  Browse Marketplace ({stats.publishedCarsCount ?? 0})
                </Link>
              </div>
            </div>

            {/* Right Live MongoDB KPI Stack */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <div className="text-2xl font-bold text-primary font-mono">
                  {totalCheckpoints}
                </div>
                <div className="text-xs font-semibold text-on-surface mt-1">
                  Diagnostic Points
                </div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Across {stats.domainsCount || domains.length} DB domains
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {stats.avgInspectedScore !== null && stats.avgInspectedScore !== undefined
                    ? `${Number(stats.avgInspectedScore).toFixed(1)}/10`
                    : "—"}
                </div>
                <div className="text-xs font-semibold text-on-surface mt-1">
                  Avg Inspected Score
                </div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  {stats.certifiedCarsCount || 0} certified of {stats.publishedCarsCount || 0} live
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <div className="text-2xl font-bold text-on-surface font-mono">
                  {stats.scheduledBookingsCount ?? 0}
                </div>
                <div className="text-xs font-semibold text-on-surface mt-1">
                  Active Bookings
                </div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  {stats.completedReportsCount ?? 0} reports completed
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <div className="text-2xl font-bold text-on-surface font-mono">
                  {stats.hubsCount || hubs.length}
                </div>
                <div className="text-xs font-semibold text-on-surface mt-1">
                  Inspection Hubs
                </div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Active nationwide centers
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Checklist Explorer (Loaded from MongoDB InspectionStandard) */}
      <section
        id="inspection-criteria"
        className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8 md:py-10"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Database Diagnostic Breakdown
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight mt-1">
              Explore the {totalCheckpoints}-Point Checklist
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Switch inspection domains or search specific tests like OBD-II, paint thickness, airbags, or Excise clearance.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined text-base text-outline absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={checkpointQuery}
              onChange={(e) => setCheckpointQuery(e.target.value)}
              placeholder="Search checkpoints (e.g. paint, OBD, AC)..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {checkpointQuery && (
              <button
                type="button"
                onClick={() => setCheckpointQuery("")}
                aria-label="Clear checkpoint search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Domain Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-5">
          {domains.map((domain) => {
            const isSelected = !checkpointQuery.trim() && activeDomain?.id === domain.id;
            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => {
                  setCheckpointQuery("");
                  setSelectedDomainId(domain.id);
                }}
                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? "bg-primary text-on-primary border-primary shadow-md"
                    : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/40 hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-base">{domain.icon}</span>
                <span>{domain.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    isSelected ? "bg-white/20 text-white" : "bg-surface-container text-primary"
                  }`}
                >
                  {domain.points} pts
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/40 p-5 sm:p-7 shadow-sm">
          {!checkpointQuery.trim() && activeDomain && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-5 border-b border-outline-variant/30">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">
                    {activeDomain.icon}
                  </span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-on-surface">
                    {activeDomain.label}
                  </h3>
                  <p className="text-xs text-on-surface-variant">{activeDomain.summary}</p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono shrink-0">
                {activeDomain.points} Total Checkpoints
              </span>
            </div>
          )}

          {visibleCheckpoints.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-outline">
                search_off
              </span>
              <p className="text-sm font-semibold text-on-surface">
                No checkpoints matched &ldquo;{checkpointQuery}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setCheckpointQuery("")}
                className="text-xs font-semibold text-primary underline"
              >
                Reset search filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleCheckpoints.map((check, idx) => (
                <div
                  key={`${check.domainLabel}-${idx}`}
                  className="p-4 rounded-2xl bg-surface-container-low/70 border border-outline-variant/30 flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-container text-primary">
                        {check.domainLabel}
                      </span>
                      {check.critical && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                          Mandatory Pass
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-on-surface leading-snug">
                      {check.name}
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                      {check.standard}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-outline-variant/25 flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm text-primary">
                      precision_manufacturing
                    </span>
                    <span>{check.tool}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Paint Depth & Grading Scale (Loaded from MongoDB) */}
      <section className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 p-6 sm:p-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Digital Coating Gauge
              </span>
              <h3 className="text-xl font-bold text-on-surface mt-1">
                How We Verify Genuine vs. Repainted Panels
              </h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Inspectors capture ultrasonic micron readings across fenders, doors, pillars, hood, roof, and trunk to detect body filler or prior repairs.
              </p>
            </div>

            <div className="space-y-3">
              {paintScale.map((tier) => {
                const styles = PAINT_TONE_STYLES[tier.tone] || PAINT_TONE_STYLES.emerald;
                return (
                  <div
                    key={tier.range}
                    className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${styles.dot}`} />
                      <div>
                        <div className="font-bold text-sm text-on-surface">{tier.label}</div>
                        <p className="text-xs text-on-surface-variant mt-0.5">{tier.detail}</p>
                      </div>
                    </div>
                    <span
                      className={`self-start sm:self-center shrink-0 px-3 py-1 rounded-full text-xs font-mono font-bold border ${styles.badge}`}
                    >
                      {tier.range}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 p-6 sm:p-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Quality Threshold
                </span>
                <h3 className="text-xl font-bold text-on-surface mt-1">
                  Certification Grading Rules
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {gradingRules.map((rule) => {
                  const styles = RULE_TONE_STYLES[rule.tone] || RULE_TONE_STYLES.neutral;
                  return (
                    <div key={rule.title} className={`p-3.5 rounded-2xl border ${styles.box}`}>
                      <div className={`flex items-center justify-between font-bold ${styles.title}`}>
                        <span>
                          {rule.scoreRange} • {rule.title}
                        </span>
                        <span className={`font-mono ${styles.status}`}>{rule.statusLabel}</span>
                      </div>
                      <p className="text-on-surface-variant mt-1 leading-relaxed">
                        {rule.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Link
              to="/sell"
              className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold text-center hover:opacity-95 transition-opacity shadow-sm"
            >
              Submit Your Vehicle for Moderation &amp; Inspection
            </Link>
          </div>
        </div>
      </section>

      {/* Regional Inspection Hubs (Loaded from MongoDB with Live Aggregations) */}
      <section className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8">
        <div className="mb-6">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Nationwide Inspection Centers
          </span>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-1">
            Regional Hubs Across Pakistan
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Click any hub to schedule your inspection appointment with live bay availability and active regional vehicle counts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {hubs.map((hub) => {
            const isSelectedHub = hubId === hub._id;
            return (
              <div
                key={hub._id}
                className={`p-5 rounded-2xl bg-surface-container-lowest border shadow-sm flex flex-col justify-between gap-4 transition-all ${
                  isSelectedHub
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-outline-variant/40"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-base text-on-surface">{hub.city}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono">
                      {hub.liveListingsCount ?? 0} live
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-on-surface/90">{hub.name}</div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {hub.address}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="pt-3 border-t border-outline-variant/25 space-y-1 text-[11px] text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">
                        schedule
                      </span>
                      <span>{hub.hours}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">
                        build_circle
                      </span>
                      <span>
                        {hub.baysLabel || `${hub.baysCount} Diagnostic Bays`} •{" "}
                        {hub.scheduledBookingsCount ?? 0} booked
                      </span>
                    </div>
                    {hub.phone && (
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">
                          call
                        </span>
                        <span className="font-mono">{hub.phone}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectHubAndScroll(hub._id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-colors ${
                      isSelectedHub
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                    }`}
                  >
                    {isSelectedHub ? "Selected Hub" : `Book at ${hub.city}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Book Inspection + My Live Bookings & Reports Section */}
      <section
        id="book-inspection"
        className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Interactive MongoDB Booking Form */}
          <form
            onSubmit={handleBookingSubmit}
            className="lg:col-span-7 p-6 sm:p-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/30">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Book Appointment in Database
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-on-surface mt-0.5">
                  Schedule a 204-Point Inspection
                </h2>
              </div>
              <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setBookingType("buyer_pre_purchase")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    bookingType === "buyer_pre_purchase"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Buyer Check
                </button>
                <button
                  type="button"
                  onClick={() => setBookingType("seller_certification")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    bookingType === "seller_certification"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Seller Certify
                </button>
              </div>
            </div>

            {bookingFeedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-medium border flex items-start gap-2 ${
                  bookingFeedback.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
              >
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                  {bookingFeedback.type === "success" ? "check_circle" : "error"}
                </span>
                <span>{bookingFeedback.text}</span>
              </div>
            )}

            {/* Vehicle Selector */}
            <div className="space-y-1.5">
              <label
                htmlFor="inspection-vehicle-select"
                className="block text-xs font-semibold text-on-surface"
              >
                Select Marketplace Vehicle or Enter Any Car
              </label>
              <select
                id="inspection-vehicle-select"
                value={selectedCarId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCarId(val);
                  const chosen = vehicleOptions.find((c) => c.id === val);
                  if (chosen) {
                    const carCity = (chosen.city || "").toLowerCase().trim();
                    const matchedHub = hubs.find((h) =>
                      (h.cityTags || [h.city.toLowerCase()]).some(
                        (t) => t.toLowerCase() === carCity
                      )
                    );
                    if (matchedHub?._id) setHubId(matchedHub._id);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="custom">
                  Other / Private Car (Enter Year, Make &amp; Model)
                </option>
                {vehicleOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {c.city} ({c.priceFormatted})
                    {c.inspectionScore ? ` [${c.inspectionScore}]` : ""}
                  </option>
                ))}
              </select>

              {selectedVehicleObj && (
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center gap-3">
                  <img
                    src={selectedVehicleObj.image}
                    alt={selectedVehicleObj.title}
                    className="w-14 h-10 rounded-lg object-cover shrink-0 bg-surface-container"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-bold text-on-surface truncate">
                      {selectedVehicleObj.title}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      {selectedVehicleObj.city} • {selectedVehicleObj.priceFormatted} • Status:{" "}
                      <span className="font-semibold capitalize">
                        {selectedVehicleObj.inspectionStatus.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Custom vehicle fields */}
            {(!selectedCarId || selectedCarId === "custom") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-vehicle-label"
                    className="block text-xs font-semibold text-on-surface"
                  >
                    Vehicle Year, Make &amp; Model
                  </label>
                  <input
                    id="custom-vehicle-label"
                    type="text"
                    value={vehicleLabel}
                    onChange={(e) => setVehicleLabel(e.target.value)}
                    placeholder="e.g. 2021 Honda Civic Oriel"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-vehicle-city"
                    className="block text-xs font-semibold text-on-surface"
                  >
                    City
                  </label>
                  <input
                    id="custom-vehicle-city"
                    type="text"
                    value={registrationCity}
                    onChange={(e) => setRegistrationCity(e.target.value)}
                    placeholder="e.g. Lahore"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            )}

            {/* Hub & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="inspection-hub-select"
                  className="block text-xs font-semibold text-on-surface"
                >
                  Inspection Center Hub
                </label>
                <select
                  id="inspection-hub-select"
                  value={hubId}
                  onChange={(e) => setHubId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {hubs.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.city} — {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="inspection-phone"
                  className="block text-xs font-semibold text-on-surface"
                >
                  Contact Phone Number
                </label>
                <input
                  id="inspection-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                />
              </div>
            </div>

            {/* Date & Time Slot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="inspection-date"
                  className="block text-xs font-semibold text-on-surface"
                >
                  Preferred Date
                </label>
                <input
                  id="inspection-date"
                  type="date"
                  min={todayLocalISO()}
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 dark:[color-scheme:dark]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="inspection-timeslot"
                  className="block text-xs font-semibold text-on-surface"
                >
                  Time Slot
                </label>
                <select
                  id="inspection-timeslot"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label
                htmlFor="inspection-notes"
                className="block text-xs font-semibold text-on-surface"
              >
                Special Focus Notes (Optional)
              </label>
              <textarea
                id="inspection-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Check hybrid battery cell balance and front right fender paint depth..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {isAuthenticated ? (
              <button
                type="submit"
                disabled={isSubmittingBooking}
                className="w-full py-3.5 px-5 rounded-xl bg-primary text-on-primary text-xs sm:text-sm font-semibold shadow-md hover:opacity-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">
                  {isSubmittingBooking ? "hourglass_top" : "event_available"}
                </span>
                <span>
                  {isSubmittingBooking
                    ? "Saving Appointment to Database..."
                    : "Confirm Inspection Appointment"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth && onOpenAuth()}
                className="w-full py-3.5 px-5 rounded-xl bg-primary text-on-primary text-xs sm:text-sm font-semibold shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                <span>Sign In to Confirm Inspection Booking</span>
              </button>
            )}
          </form>

          {/* Right: Live Inspection Bookings & Reports from MongoDB */}
          <div className="lg:col-span-5 p-6 sm:p-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-outline-variant/30">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Live MongoDB Records
                </span>
                <h3 className="text-lg font-bold text-on-surface mt-0.5">
                  {isAdmin && bookingScope === "all"
                    ? "Platform Inspection Queue"
                    : "My Bookings & Reports"}
                </h3>
              </div>

              {isAuthenticated && isAdmin && (
                <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant/30 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBookingScope("mine")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                      bookingScope === "mine"
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant"
                    }`}
                  >
                    Mine
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingScope("all")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                      bookingScope === "all"
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant"
                    }`}
                  >
                    All ({bookings.length})
                  </button>
                </div>
              )}
            </div>

            {!isAuthenticated ? (
              <div className="py-10 text-center space-y-3">
                <span className="material-symbols-outlined text-4xl text-outline">
                  assignment
                </span>
                <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                  Sign in to view your scheduled inspections, download digital condition scores, or manage upcoming hub visits.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAuth && onOpenAuth()}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-xs font-semibold text-primary"
                >
                  Sign In
                </button>
              </div>
            ) : isLoadingBookings ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-28 rounded-2xl bg-surface-container-low border border-outline-variant/30"
                  />
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <span className="material-symbols-outlined text-4xl text-outline">
                  event_note
                </span>
                <p className="text-xs font-semibold text-on-surface">
                  No inspection bookings recorded yet
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Schedule your first 204-point diagnostic slot using the form.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                {bookings.map((b) => {
                  const isCompleted = b.status === "completed";
                  const isCancelled = b.status === "cancelled";
                  const isReportExpanded = expandedReportId === b._id;
                  const canCancel =
                    (b.status === "scheduled" || b.status === "in_progress") &&
                    (isAdmin || String(b.user?._id || b.user) === String(user?._id || user?.id));

                  const statusBadgeClass = isCompleted
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : isCancelled
                    ? "bg-surface-container text-on-surface-variant border-outline-variant/40"
                    : "bg-primary/10 text-primary border-primary/30";

                  return (
                    <div
                      key={b._id}
                      className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-on-surface truncate">
                            {b.car?._id ? (
                              <Link
                                to={`/cars/${b.car._id}`}
                                className="hover:text-primary transition-colors"
                              >
                                {b.vehicleLabel}
                              </Link>
                            ) : (
                              b.vehicleLabel
                            )}
                          </div>
                          <div className="text-[11px] text-on-surface-variant mt-0.5">
                            {b.hub?.city || b.registrationCity} •{" "}
                            {new Date(b.preferredDate).toLocaleDateString("en-PK")} • {b.timeSlot}
                          </div>
                          {isAdmin && bookingScope === "all" && b.user?.name && (
                            <div className="text-[11px] text-on-surface-variant mt-0.5">
                              Requested by <span className="font-semibold">{b.user.name}</span> ({b.contactPhone})
                            </div>
                          )}
                        </div>

                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusBadgeClass}`}
                        >
                          {isCompleted && typeof b.score === "number"
                            ? `${Number(b.score).toFixed(1)}/10 ${b.grade}`
                            : b.status}
                        </span>
                      </div>

                      {b.notes && (
                        <p className="text-[11px] text-on-surface-variant italic">
                          Note: &ldquo;{b.notes}&rdquo;
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedReportId(isReportExpanded ? null : b._id)
                            }
                            className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-[11px] font-semibold text-primary"
                          >
                            {isReportExpanded ? "Hide Report" : "View Report Breakdown"}
                          </button>
                        )}

                        {isAdmin && !isCancelled && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleOpenCompleteModal(b)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                          >
                            Record Score / Complete
                          </button>
                        )}

                        {canCancel && (
                          <button
                            type="button"
                            disabled={processingBookingId === b._id}
                            onClick={() => handleCancelBooking(b._id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-[11px] font-semibold text-rose-700 dark:text-rose-300 disabled:opacity-50"
                          >
                            {processingBookingId === b._id ? "Cancelling..." : "Cancel Slot"}
                          </button>
                        )}
                      </div>

                      {isCompleted && isReportExpanded && (
                        <div className="pt-2.5 mt-1 border-t border-outline-variant/25 space-y-2">
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              ["Engine", b.domainScores?.engine],
                              ["Chassis", b.domainScores?.chassis],
                              ["Suspension", b.domainScores?.suspension],
                              ["Electrical", b.domainScores?.interior],
                              ["Road", b.domainScores?.road],
                              ["Excise", b.domainScores?.documents],
                            ].map(([label, scoreVal]) => (
                              <div
                                key={label}
                                className="px-2 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-center"
                              >
                                <div className="text-[10px] text-on-surface-variant">
                                  {label}
                                </div>
                                <div className="text-[11px] font-bold font-mono text-on-surface">
                                  {typeof scoreVal === "number" ? `${scoreVal.toFixed(1)}/10` : "—"}
                                </div>
                              </div>
                            ))}
                          </div>
                          {b.inspectorNotes && (
                            <p className="text-[11px] text-on-surface-variant bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/25">
                              <span className="font-semibold text-on-surface">Inspector:</span>{" "}
                              {b.inspectorNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Published MongoDB Inventory with Real DB Inspection Status */}
      <section className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8 md:py-12">
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Live MongoDB Inventory
            </span>
            <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-1">
              Vehicles &amp; Inspection Status
            </h2>
          </div>
          <Link
            to="/"
            className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>View all inventory</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>

        {featuredCars.length === 0 ? (
          <div className="p-10 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-center text-xs text-on-surface-variant">
            No published listings are currently in the database.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredCars.map((car) => {
              const isFav = favorites.has(car.id);
              return (
                <div
                  key={car.id}
                  className="group rounded-2xl bg-surface-container-lowest border border-outline-variant/35 overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-md transition-all flex flex-col"
                >
                  <Link
                    to={`/cars/${car.id}`}
                    className="relative aspect-[3/2] bg-surface-container overflow-hidden block"
                  >
                    <img
                      src={car.image}
                      alt={car.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />

                    {/* Real DB Inspection Pill */}
                    {car.isVerified ? (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-outline-variant/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        {car.isCertified ? "Certified" : "Verified"} {car.inspectionScore}
                      </div>
                    ) : car.inspectionStatus === "scheduled" ? (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-primary text-[10px] font-bold border border-outline-variant/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">event_available</span>
                        Scheduled
                      </div>
                    ) : car.inspectionStatus === "flagged" ? (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        Flagged {car.inspectionScore}
                      </div>
                    ) : (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-on-surface-variant text-[10px] font-semibold border border-outline-variant/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-outline">
                          pending_actions
                        </span>
                        Not Inspected
                      </div>
                    )}

                    {onToggleFavorite && (
                      <button
                        type="button"
                        aria-label="Save to favorites"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleFavorite(car.id);
                        }}
                        className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-center shadow-sm ${
                          isFav ? "text-error" : "text-on-surface-variant hover:text-error"
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-lg"
                          style={isFav ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          favorite
                        </span>
                      </button>
                    )}
                  </Link>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                    <Link to={`/cars/${car.id}`} className="block">
                      <h3 className="font-bold text-sm text-on-surface truncate capitalize">
                        {car.title}
                      </h3>
                      <div className="text-base font-bold text-primary font-mono mt-0.5">
                        {car.priceFormatted}
                      </div>
                    </Link>

                    <div className="pt-2.5 border-t border-outline-variant/25 flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
                      <span>
                        {car.city} • {car.mileage}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInspectCarShortcut(car)}
                        className="font-semibold text-primary hover:underline shrink-0"
                      >
                        {car.isVerified ? "Re-Inspect" : "Book Check"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Admin Inspection Score Completion Modal */}
      {completingBooking && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCompletingBooking(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitCompleteReport}
            className="w-full max-w-lg rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-outline-variant/30">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Admin Inspection Report
                </span>
                <h3 className="text-lg font-bold text-on-surface">
                  Record Official Score — {completingBooking.vehicleLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCompletingBooking(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {completeError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
                {completeError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-on-surface">
                Overall Inspection Score (0.0 – 10.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm font-mono font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[11px] text-on-surface-variant">
                ≥9.0 = Certified • 7.5–8.9 = Verified • &lt;7.5 = Flagged
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                ["engine", "Engine & ECU"],
                ["chassis", "Chassis & Paint"],
                ["suspension", "Suspension"],
                ["interior", "Electrical"],
                ["road", "Road & NVH"],
                ["documents", "Excise / Docs"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="block text-[11px] font-semibold text-on-surface-variant">
                    {label}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={domainScoresInput[key]}
                    onChange={(e) =>
                      setDomainScoresInput((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-on-surface">
                Inspector Findings &amp; Notes
              </label>
              <textarea
                rows={3}
                value={inspectorNotesInput}
                onChange={(e) => setInspectorNotesInput(e.target.value)}
                placeholder="Document panel micron readings, OBD-II scan status, tire wear, and Excise verification findings..."
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletingBooking(null)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingComplete}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-95 disabled:opacity-60"
              >
                {isSubmittingComplete ? "Saving..." : "Save Official Report"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
