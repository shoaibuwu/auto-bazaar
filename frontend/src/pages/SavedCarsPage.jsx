import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getUserFavoriteCars, getPublishedCars, getCarById } from "../api/cars.api";
import { useAuth } from "../context/AuthContext";

export default function SavedCarsPage({
  favorites = new Set(),
  isFavoritesSyncing = false,
  favoritesSyncVersion = 0,
  onToggleFavorite,
  onOpenAuth,
}) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [savedCars, setSavedCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // "recent" | "price_asc" | "price_desc"
  const requestSeqRef = useRef(0);
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;
  const lastFetchedFavKeyRef = useRef("");

  const favoritesKey = useMemo(
    () => Array.from(favorites).sort().join(","),
    [favorites]
  );

  const loadSavedCars = useCallback(async () => {
    if (isFavoritesSyncing) return;

    const seq = ++requestSeqRef.current;
    const currentFavs = favoritesRef.current;
    lastFetchedFavKeyRef.current = Array.from(currentFavs).sort().join(",");

    try {
      setIsLoading(true);
      setError("");

      if (isAuthenticated) {
        const list = await getUserFavoriteCars();
        if (seq === requestSeqRef.current) {
          setSavedCars(list);
        }
        return;
      }

      // Guest fallback: resolve local favorited IDs against live published MongoDB listings
      if (currentFavs.size === 0) {
        if (seq === requestSeqRef.current) setSavedCars([]);
        return;
      }

      const published = await getPublishedCars({ limit: 50 });
      const matched = published.filter((c) => currentFavs.has(c.id));
      const matchedIds = new Set(matched.map((c) => c.id));
      const missingIds = Array.from(currentFavs).filter((id) => !matchedIds.has(id));

      if (missingIds.length > 0) {
        const extraResults = await Promise.allSettled(
          missingIds.map((id) => getCarById(id))
        );
        extraResults.forEach((res) => {
          if (res.status === "fulfilled" && res.value) {
            matched.push(res.value);
          }
        });
      }

      if (seq === requestSeqRef.current) {
        setSavedCars(matched);
      }
    } catch (err) {
      if (seq === requestSeqRef.current) {
        setError(err.message || "Could not load saved vehicles.");
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, isFavoritesSyncing]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (isFavoritesSyncing) return;
    loadSavedCars();
  }, [isFavoritesSyncing, favoritesSyncVersion, loadSavedCars]);

  // If new IDs were added externally after sync completed, re-fetch once
  useEffect(() => {
    if (isFavoritesSyncing || isLoading || favoritesKey === lastFetchedFavKeyRef.current) return;
    const loadedIds = new Set(savedCars.map((c) => c.id));
    const hasAddedMissing = Array.from(favorites).some((id) => !loadedIds.has(id));
    if (hasAddedMissing) {
      loadSavedCars();
    }
  }, [favorites, favoritesKey, isFavoritesSyncing, isLoading, loadSavedCars, savedCars]);

  const handleRemoveFavorite = async (carId) => {
    if (!onToggleFavorite || pendingRemoveId === carId) return;
    setPendingRemoveId(carId);
    try {
      await onToggleFavorite(carId);
    } finally {
      setPendingRemoveId(null);
    }
  };

  // Derive live saved list directly from `favorites` Set so unsaving updates instantaneously
  // without redundant API calls or race conditions
  const activeSavedCars = useMemo(
    () => savedCars.filter((car) => favorites.has(car.id)),
    [savedCars, favorites]
  );

  const handleChatSeller = (car) => {
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    const sellerId =
      car.seller?._id || (typeof car.seller === "string" ? car.seller : null);
    const isOwner = Boolean(
      user && sellerId && String(user._id || user.id) === String(sellerId)
    );
    if (isOwner) {
      navigate("/inquiries?tab=received");
      return;
    }
    navigate(`/inquiries?carId=${car.id}`);
  };

  const visibleCars = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = activeSavedCars.filter((car) => {
      if (!q) return true;
      return (
        car.title.toLowerCase().includes(q) ||
        car.city.toLowerCase().includes(q) ||
        car.fuel.toLowerCase().includes(q)
      );
    });

    if (sortBy === "price_asc") {
      return [...filtered].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortBy === "price_desc") {
      return [...filtered].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    return filtered;
  }, [activeSavedCars, searchQuery, sortBy]);

  return (
    <div className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8 md:py-12 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/25 text-xs font-bold">
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              favorite
            </span>
            <span>
              {(isFavoritesSyncing || isLoading) ? favorites.size : activeSavedCars.length} Saved Vehicle{((isFavoritesSyncing || isLoading) ? favorites.size : activeSavedCars.length) === 1 ? "" : "s"}
            </span>
            <span>•</span>
            <span>{isAuthenticated ? "Synced to Account" : "Guest Session"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
            Your Saved Garage
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
            Shortlist vehicles, check real inspection grades, and message sellers directly when you are ready to negotiate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => onOpenAuth && onOpenAuth()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-sm hover:opacity-95 transition-opacity"
            >
              <span className="material-symbols-outlined text-base">login</span>
              Sign In to Sync
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-xs font-semibold text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base text-primary">
              directions_car
            </span>
            Browse Inventory
          </Link>
        </div>
      </div>

      {/* Filter & Sort Controls (Shown when user has saved vehicles) */}
      {activeSavedCars.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined text-base text-outline absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter saved cars by title or city..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear filter"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <label
              htmlFor="saved-sort"
              className="text-xs font-semibold text-on-surface-variant"
            >
              Sort:
            </label>
            <select
              id="saved-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="recent">Recently Saved</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadSavedCars}
            className="font-semibold underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content Area */}
      {(isLoading || isFavoritesSyncing) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-80 rounded-2xl bg-surface-container-lowest border border-outline-variant/30"
            />
          ))}
        </div>
      ) : activeSavedCars.length === 0 ? (
        <div className="py-16 px-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/35 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">favorite_border</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-on-surface">
              No Saved Vehicles Yet
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
              Tap the heart icon on any vehicle card or details page to shortlist cars here for quick price comparisons and seller chat.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary text-xs sm:text-sm font-semibold shadow-md hover:opacity-95 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">search</span>
            Explore Used Cars
          </Link>
        </div>
      ) : visibleCars.length === 0 ? (
        <div className="py-12 px-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 text-center space-y-2">
          <p className="text-sm font-semibold text-on-surface">
            No saved vehicles matched &ldquo;{searchQuery}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-xs font-semibold text-primary underline"
          >
            Show all {activeSavedCars.length} saved cars
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleCars.map((car) => {
            const sellerId =
              car.seller?._id ||
              (typeof car.seller === "string" ? car.seller : null);
            const isOwner = Boolean(
              user && sellerId && String(user._id || user.id) === String(sellerId)
            );

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

                  {/* Real Inspection / Availability Status Badge */}
                  {car.status !== "published" ? (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wide border border-amber-500/30 shadow-sm">
                      {car.status.replace(/_/g, " ")}
                    </div>
                  ) : car.isVerified ? (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1 border border-outline-variant/30 shadow-sm">
                      <span className="material-symbols-outlined text-sm text-emerald-500">
                        check_circle
                      </span>
                      {car.isCertified ? "Certified" : "Verified"} {car.inspectionScore}
                    </div>
                  ) : car.inspectionStatus === "scheduled" ? (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-primary text-[11px] font-semibold flex items-center gap-1 border border-outline-variant/30 shadow-sm">
                      <span className="material-symbols-outlined text-sm">
                        event_available
                      </span>
                      Scheduled
                    </div>
                  ) : car.inspectionStatus === "flagged" ? (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1 border border-rose-500/30 shadow-sm">
                      <span className="material-symbols-outlined text-sm">warning</span>
                      Flagged {car.inspectionScore}
                    </div>
                  ) : null}

                  {/* Unsave Heart Button */}
                  <button
                    type="button"
                    aria-label="Remove from saved cars"
                    title="Remove from saved"
                    disabled={pendingRemoveId === car.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveFavorite(car.id);
                    }}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-lowest/95 backdrop-blur-md flex items-center justify-center text-error hover:scale-105 disabled:opacity-50 transition-all shadow-sm"
                  >
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      favorite
                    </span>
                  </button>
                </Link>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <Link
                      to={`/cars/${car.id}`}
                      className="font-bold text-sm text-on-surface hover:text-primary transition-colors block truncate capitalize"
                    >
                      {car.title}
                    </Link>
                    <div className="text-lg font-bold text-primary font-mono mt-0.5">
                      {car.priceFormatted}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1.5 truncate">
                      {car.year} • {car.mileage} • {car.fuel} • {car.city}
                    </p>
                    {car.savedAt && (
                      <p className="text-[11px] text-outline mt-1">
                        Saved {new Date(car.savedAt).toLocaleDateString("en-PK")}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-outline-variant/25 grid grid-cols-2 gap-2">
                    <Link
                      to={`/cars/${car.id}`}
                      className="py-2 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-semibold text-on-surface text-center transition-colors"
                    >
                      View Details
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleChatSeller(car)}
                      className="py-2 px-3 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-95 transition-opacity flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">forum</span>
                      <span>{isOwner ? "Seller Inbox" : "Chat Seller"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
