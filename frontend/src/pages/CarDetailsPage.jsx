import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getCarById } from "../api/cars.api";
import { getLatestCarInspection } from "../api/inspections.api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

export default function CarDetailsPage({
  favorites = new Set(),
  onToggleFavorite,
  onOpenAuth,
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { onlineMap, checkUsersOnline, unreadCount } = useSocket();

  const [car, setCar] = useState(null);
  const [inspectionReport, setInspectionReport] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch single car + latest completed DB inspection report from API
  const fetchCarDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [data, reportData] = await Promise.all([
        getCarById(id),
        getLatestCarInspection(id).catch(() => null),
      ]);
      setCar(data);
      setInspectionReport(reportData);
      setActiveImage(data.image);
    } catch (err) {
      setError(err.message || "Failed to load car details");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCarDetails();
    window.scrollTo(0, 0);
  }, [fetchCarDetails]);

  const sellerId = car?.seller?._id || (typeof car?.seller === "string" ? car.seller : null);
  const isSellerOnline = sellerId ? Boolean(onlineMap[String(sellerId)]) : false;
  const isFavorite = car ? favorites.has(car.id) : false;
  const isOwner = Boolean(
    user && sellerId && String(user._id || user.id) === String(sellerId)
  );

  useEffect(() => {
    if (isAuthenticated && sellerId) {
      checkUsersOnline([String(sellerId)]);
    }
  }, [isAuthenticated, sellerId, checkUsersOnline]);

  // Open direct real-time chat with seller
  const handleStartChat = () => {
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    if (isOwner) {
      navigate("/inquiries?tab=received");
      return;
    }
    navigate(`/inquiries?carId=${car.id}`);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8 md:py-12 animate-pulse">
        <div className="h-4 w-48 bg-surface-container rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="w-full aspect-[16/10] bg-surface-container rounded-2xl" />
            <div className="h-8 w-2/3 bg-surface-container rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-20 bg-surface-container rounded-xl" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="h-40 bg-surface-container rounded-2xl" />
            <div className="h-64 bg-surface-container rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error / Not found state
  if (error || !car) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-24 text-center">
        <span className="material-symbols-outlined text-6xl text-error mb-4">
          error_outline
        </span>
        <h2 className="text-2xl font-bold text-on-surface mb-2">Car Not Found</h2>
        <p className="text-on-surface-variant mb-6">
          The vehicle you are looking for may have been sold or removed by the seller.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-95 transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-6 md:py-10">
      
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-on-surface-variant mb-6 flex-wrap">
        <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-base">home</span>
          Home
        </Link>
        <span>/</span>
        <Link to="/" className="hover:text-primary transition-colors">
          Used Cars
        </Link>
        <span>/</span>
        <span className="text-on-surface font-semibold truncate max-w-xs">{car.title}</span>
      </nav>

      {/* Main Grid: Left (Images & Specs) - Right (Pricing & Seller Inquiry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Media, Highlights, Specs & Report */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Main Car Photo & Badges */}
          <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/40 shadow-sm">
            <img
              src={activeImage}
              alt={car.title}
              className="w-full h-full object-cover transition-all duration-300"
            />

            {/* Real DB Inspection Status Badge */}
            {car.isVerified ? (
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-md border border-outline-variant/30">
                <span className="material-symbols-outlined text-base text-emerald-500">
                  check_circle
                </span>
                {car.isCertified ? "Certified" : "Verified"} {car.inspectionScore}
              </div>
            ) : car.inspectionStatus === "scheduled" ? (
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-primary text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-md border border-outline-variant/30">
                <span className="material-symbols-outlined text-base">
                  event_available
                </span>
                Inspection Scheduled
              </div>
            ) : car.inspectionStatus === "flagged" ? (
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-rose-600 dark:text-rose-400 text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-md border border-rose-500/30">
                <span className="material-symbols-outlined text-base">
                  warning
                </span>
                Flagged {car.inspectionScore}
              </div>
            ) : (
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-on-surface-variant text-xs font-semibold tracking-wide flex items-center gap-1.5 shadow-md border border-outline-variant/30">
                <span className="material-symbols-outlined text-base text-outline">
                  pending_actions
                </span>
                Pending Inspection
              </div>
            )}

            {/* Favorite Button */}
            <button
              type="button"
              onClick={() => onToggleFavorite && onToggleFavorite(car.id)}
              className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-container-lowest/95 backdrop-blur-md flex items-center justify-center transition-all shadow-md ${
                isFavorite ? "text-error" : "text-on-surface-variant hover:text-error"
              }`}
              aria-label="Save to favorites"
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                favorite
              </span>
            </button>
          </div>

          {/* Multiple Image Thumbnails (if available) */}
          {car.images && car.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
              {car.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`relative shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    activeImage === img
                      ? "border-primary shadow-md"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt={`${car.title} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Vehicle Title & Location Heading */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-outline-variant/30">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                {car.title}
              </h1>
              <p className="text-sm text-on-surface-variant mt-1.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-outline">location_on</span>
                <span>{car.city}, Pakistan</span>
                <span>•</span>
                <span>
                  {car.isVerified
                    ? `${car.isCertified ? "Certified" : "Verified"} Inspection (${car.inspectionScore})`
                    : car.inspectionStatus === "scheduled"
                    ? "Inspection Slot Scheduled"
                    : car.inspectionStatus === "flagged"
                    ? `Inspection Flagged (${car.inspectionScore})`
                    : "Awaiting 204-Point Inspection"}
                </span>
              </p>
            </div>
            <div className="lg:hidden text-2xl font-bold text-primary">
              {car.priceFormatted}
            </div>
          </div>

          {/* 6 Key Specifications Cards */}
          <div>
            <h2 className="text-base font-bold text-on-surface uppercase tracking-wider mb-4">
              Key Specifications
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
                <span className="material-symbols-outlined text-2xl text-primary p-2 rounded-lg bg-surface-container">
                  speed
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">Mileage</div>
                  <div className="font-bold text-sm text-on-surface mt-0.5">{car.mileage}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
                <span className="material-symbols-outlined text-2xl text-primary p-2 rounded-lg bg-surface-container">
                  local_gas_station
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">Fuel Type</div>
                  <div className="font-bold text-sm text-on-surface mt-0.5">{car.fuel}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
                <span className="material-symbols-outlined text-2xl text-primary p-2 rounded-lg bg-surface-container">
                  settings
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">Transmission</div>
                  <div className="font-bold text-sm text-on-surface mt-0.5">{car.transmission}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
                <span className="material-symbols-outlined text-2xl text-primary p-2 rounded-lg bg-surface-container">
                  calendar_month
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">Model Year</div>
                  <div className="font-bold text-sm text-on-surface mt-0.5">{car.year}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
                <span className="material-symbols-outlined text-2xl text-primary p-2 rounded-lg bg-surface-container">
                  directions_car
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">Body Type</div>
                  <div className="font-bold text-sm text-on-surface mt-0.5 capitalize">{car.bodyType}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
                <span className="material-symbols-outlined text-2xl text-primary p-2 rounded-lg bg-surface-container">
                  verified
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">Inspection</div>
                  <div
                    className={`font-bold text-sm mt-0.5 ${
                      car.isVerified
                        ? "text-emerald-600 dark:text-emerald-400"
                        : car.inspectionStatus === "flagged"
                        ? "text-rose-600 dark:text-rose-400"
                        : car.inspectionStatus === "scheduled"
                        ? "text-primary"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {car.isVerified
                      ? `${car.inspectionScore} ${car.isCertified ? "Certified" : "Verified"}`
                      : car.inspectionStatus === "scheduled"
                      ? "Scheduled"
                      : car.inspectionStatus === "flagged"
                      ? `${car.inspectionScore} Flagged`
                      : "Not Inspected"}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Live Database Inspection Report / Booking Card */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    car.isVerified
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : car.inspectionStatus === "flagged"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">verified_user</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-on-surface">
                    {inspectionReport
                      ? `204-Point Inspection Report • ${inspectionReport.grade} (${Number(
                          inspectionReport.score
                        ).toFixed(1)}/10)`
                      : car.inspectionStatus === "scheduled"
                      ? "Inspection Appointment Scheduled"
                      : "AutoBazaar 204-Point Inspection Available"}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    {inspectionReport
                      ? `Inspected at ${inspectionReport.hub?.city || car.city} Hub${
                          inspectionReport.completedAt
                            ? ` on ${new Date(inspectionReport.completedAt).toLocaleDateString("en-PK")}`
                            : ""
                        } by ${inspectionReport.inspectorName || "Certified Inspector"}.`
                      : "Request an ultrasonic paint-depth scan, OEM OBD-II telemetry audit, road test, and provincial Excise verification at our nearest hub."}
                  </p>
                </div>
              </div>

              <Link
                to={`/inspections?carId=${car.id}#book-inspection`}
                className="shrink-0 px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-semibold text-primary transition-colors flex items-center gap-1"
              >
                <span>{inspectionReport ? "Inspection Standards" : "Book Inspection"}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>

            {inspectionReport?.domainScores && (
              <div className="pt-3 border-t border-outline-variant/25 space-y-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    ["Engine", inspectionReport.domainScores.engine],
                    ["Chassis", inspectionReport.domainScores.chassis],
                    ["Suspension", inspectionReport.domainScores.suspension],
                    ["Electrical", inspectionReport.domainScores.interior],
                    ["Road Test", inspectionReport.domainScores.road],
                    ["Excise", inspectionReport.domainScores.documents],
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      className="px-2.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/25 text-center"
                    >
                      <div className="text-[10px] uppercase font-semibold text-on-surface-variant">
                        {label}
                      </div>
                      <div className="text-xs font-bold font-mono text-on-surface mt-0.5">
                        {typeof val === "number" ? `${val.toFixed(1)}/10` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
                {inspectionReport.inspectorNotes && (
                  <p className="text-xs text-on-surface-variant bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/25">
                    <span className="font-semibold text-on-surface">Inspector Notes:</span>{" "}
                    {inspectionReport.inspectorNotes}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description Section */}
          {car.description && (
            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <h2 className="text-base font-bold text-on-surface uppercase tracking-wider mb-3">
                Seller's Description
              </h2>
              <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                {car.description}
              </p>
            </div>
          )}

        </div>

        {/* Right Column: Sticky Pricing, Seller Card & Direct Inquiry */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          
          {/* Price & Action Box */}
          <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl space-y-5">
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Certified Price
              </span>
              <div className="text-3xl font-bold text-on-surface mt-1 tracking-tight">
                {car.priceFormatted}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-emerald-500">lock</span>
                Includes document verification & transfer support
              </p>
            </div>

            {/* Seller Overview */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full bg-primary text-on-primary font-bold text-base flex items-center justify-center shrink-0 ring-2 ring-primary/20">
                {car.seller?.name ? car.seller.name.charAt(0).toUpperCase() : "S"}
                {isSellerOnline && (
                  <span
                    title="Seller is online"
                    className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface-container-low"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-on-surface truncate">
                  {car.seller?.name || "Verified Seller"}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-0.5">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      isSellerOnline ? "bg-emerald-500 animate-pulse" : "bg-outline/60"
                    }`}
                  />
                  <span className="capitalize">
                    {isSellerOnline ? "Online now" : car.seller?.role || "Seller"}
                  </span>
                  {car.seller?.phoneNumber && (
                    <>
                      <span>•</span>
                      <span className="truncate font-mono">{car.seller.phoneNumber}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Direct Live Chat CTA (Single inviting button under seller name & phone) */}
            <button
              type="button"
              onClick={handleStartChat}
              className="group w-full p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-primary to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0 text-left">
                <div className="relative w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">forum</span>
                  {!isOwner && isSellerOnline && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-indigo-600 animate-pulse" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm tracking-tight flex items-center gap-2">
                    <span>{isOwner ? "Open Seller Chat Inbox" : "Chat with Seller"}</span>
                    {!isOwner && isSellerOnline && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                        Live
                      </span>
                    )}
                    {isOwner && unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/80 truncate">
                    {isOwner
                      ? "Your listing • Reply to interested buyers live"
                      : "Negotiate price or schedule an inspection live"}
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-lg shrink-0 group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>

          </div>

          {/* Platform Guarantee Reminder */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant space-y-1.5">
            <div className="font-semibold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-sm">shield</span>
              Safe Buyer Guarantee
            </div>
            <p className="leading-relaxed">
              Never transfer token money without seeing the car or official biometric verification through our certified centers.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
