import React from "react";
import { Link } from "react-router-dom";

export default function FeaturedCars({
  cars = [],
  favorites = new Set(),
  isLoading = false,
  onToggleFavorite,
  onResetFilters
}) {
  return (
    <section className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8 md:py-12">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-space-xs mb-space-lg">
        <div className="flex items-baseline gap-space-sm flex-wrap">
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface tracking-tight">
            Featured cars
          </h2>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {isLoading
              ? "Fetching live inventory from database..."
              : `Showing ${cars.length} verified vehicle${cars.length === 1 ? "" : "s"} from database`}
          </span>
        </div>
        <a
          className="font-title text-body-md text-on-surface hover:text-primary transition-colors flex items-center gap-1 font-medium group"
          href="#browse"
        >
          <span>View all {cars.length} verified cars</span>
          <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1">
            arrow_forward
          </span>
        </a>
      </div>

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md md:gap-space-lg">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="rounded-[14px] bg-surface-container-lowest border border-outline-variant/30 overflow-hidden shadow-sm animate-pulse"
            >
              <div className="w-full aspect-[3/2] bg-surface-container/70" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 rounded bg-surface-container/80" />
                <div className="h-6 w-1/2 rounded bg-surface-container/60" />
                <div className="h-4 w-full rounded bg-surface-container/40" />
              </div>
            </div>
          ))}
        </div>
      ) : cars.length === 0 ? (
        /* Empty State */
        <div className="w-full py-16 px-4 bg-surface-container-lowest rounded-[14px] border border-outline-variant/30 text-center flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-outline mb-3">
            directions_car
          </span>
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-1">
            No cars found in database
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-4">
            There are currently no matching published cars in MongoDB. You can adjust your filters or add a new car through the seller portal.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="px-5 py-2.5 rounded-[10px] bg-primary text-on-primary font-title text-body-md font-medium hover:opacity-95 transition-opacity"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        /* 3-Column Strict Inventory Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md md:gap-space-lg">
          {cars.map((car) => {
            const isFav = favorites.has(car.id);

            return (
              <Link
                key={car.id}
                to={`/cars/${car.id}`}
                className="car-listing-card group flex flex-col rounded-[14px] bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/30 overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer text-left block"
              >
                {/* Image & Badges Container */}
                <div className="relative w-full aspect-[3/2] overflow-hidden bg-surface-container">
                  <img
                    alt={car.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                    src={car.image}
                  />

                  {/* Verification Badge */}
                  {car.isVerified && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-emerald-600 dark:text-emerald-400 font-label-sm text-[11px] font-semibold tracking-wide flex items-center gap-1 shadow-sm border border-outline-variant/30">
                      <span className="material-symbols-outlined text-sm leading-none text-emerald-500">
                        check_circle
                      </span>
                      Certified
                    </div>
                  )}

                  {/* Favorite Heart Button */}
                  <button
                    aria-label="Save to favorites"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleFavorite(car.id);
                    }}
                    className={`absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-center transition-colors shadow-sm ${
                      isFav
                        ? "text-error"
                        : "text-on-surface-variant hover:text-error"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-xl"
                      style={
                        isFav ? { fontVariationSettings: "'FILL' 1" } : undefined
                      }
                    >
                      favorite
                    </span>
                  </button>
                </div>

                {/* Car Details Info */}
                <div className="p-space-md flex flex-col">
                  <h3 className="font-title text-title font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                    {car.title}
                  </h3>
                  <div className="font-price-lg text-price-lg font-semibold text-on-surface mt-1 tnum">
                    {car.priceFormatted}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 truncate">
                    {car.year} • {car.mileage} • {car.fuel} • {car.city}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
