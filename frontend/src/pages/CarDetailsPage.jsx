import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getCarById, sendCarInquiry } from "../api/cars.api";
import { useAuth } from "../context/AuthContext";

export default function CarDetailsPage({
  favorites = new Set(),
  onToggleFavorite,
  onOpenAuth,
}) {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();

  const [car, setCar] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inquiry form states
  const [message, setMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSendingInquiry, setIsSendingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState("");

  // Fetch single car from API
  const fetchCarDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCarById(id);
      setCar(data);
      setActiveImage(data.image);
      setMessage(`Hi ${data.seller?.name || "Seller"}, I am interested in your ${data.title}. Is it still available for inspection?`);
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

  // Handle inquiry submission
  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (!message.trim()) {
      setInquiryError("Please enter a message for the seller.");
      return;
    }

    try {
      setIsSendingInquiry(true);
      setInquiryError("");
      await sendCarInquiry(id, { message, phoneNumber });
      setInquirySuccess(true);
    } catch (err) {
      setInquiryError(err.message || "Failed to send inquiry to seller.");
    } finally {
      setIsSendingInquiry(false);
    }
  };

  const isFavorite = car ? favorites.has(car.id) : false;
  const isOwner = user && car && car.seller && (user._id === car.seller._id || user._id === car.seller);

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

            {/* Verification Badge */}
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-md border border-outline-variant/30">
              <span className="material-symbols-outlined text-base text-emerald-500">
                check_circle
              </span>
              Certified {car.inspectionScore}
            </div>

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
                <span>Verified Inspection Passed</span>
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
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">Condition</div>
                  <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {car.inspectionScore} Certified
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Inspection Report Guarantee Card */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">verified_user</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-on-surface">AutoBazaar 200+ Point Inspection Guaranteed</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Full diagnostics performed on chassis integrity, OBD-II ECU scanner, engine compression, and NADRA biometric verification.
                </p>
              </div>
            </div>
            <div className="shrink-0 px-3 py-1.5 rounded-lg bg-surface-container text-xs font-semibold text-primary">
              Score {car.inspectionScore}
            </div>
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
              <div className="w-11 h-11 rounded-full bg-primary text-on-primary font-bold text-base flex items-center justify-center shrink-0 ring-2 ring-primary/20">
                {car.seller?.name ? car.seller.name.charAt(0).toUpperCase() : "S"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-on-surface truncate">
                  {car.seller?.name || "Verified Seller"}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="capitalize">{car.seller?.role || "Seller"}</span>
                  {car.seller?.phoneNumber && (
                    <>
                      <span>•</span>
                      <span className="truncate">{car.seller.phoneNumber}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Inquiry Form */}
            <div className="pt-2 border-t border-outline-variant/30">
              <h3 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">mail</span>
                Send Inquiry to Seller
              </h3>

              {isOwner ? (
                <div className="p-3.5 rounded-xl bg-surface-container text-xs text-on-surface-variant border border-outline-variant/30">
                  ℹ️ This is your listing. Buyers will send inquiries here directly to your account.
                </div>
              ) : inquirySuccess ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    Inquiry Sent Successfully!
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Your inquiry has been delivered to {car.seller?.name || "the seller"}. They will contact you shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setInquirySuccess(false)}
                    className="text-xs font-semibold underline text-primary mt-1"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-3">
                  {inquiryError && (
                    <div className="p-2.5 rounded-lg bg-error/10 border border-error/20 text-error text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm shrink-0">error</span>
                      <span>{inquiryError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                      Message
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ask about car condition, price, or schedule a test drive..."
                      className="w-full p-3 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                      Your Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </div>

                  {isAuthenticated ? (
                    <button
                      type="submit"
                      disabled={isSendingInquiry}
                      className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-semibold text-xs shadow-md hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSendingInquiry ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending message...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">send</span>
                          <span>Send Message to Seller</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-semibold text-xs shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">lock</span>
                      <span>Sign In to Contact Seller</span>
                    </button>
                  )}
                </form>
              )}
            </div>

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
