import React from "react";

export default function FeaturedCars({
  cars = [],
  favorites = new Set(),
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
            Showing {cars.length} handpicked verified vehicles
          </span>
        </div>
        <a
          className="font-title text-body-md text-on-surface hover:text-primary transition-colors flex items-center gap-1 font-medium group"
          href="#browse"
        >
          <span>View all 1,420 cars</span>
          <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1">
            arrow_forward
          </span>
        </a>
      </div>

      {/* Empty State */}
      {cars.length === 0 ? (
        <div className="w-full py-16 px-4 bg-surface-container-lowest rounded-[14px] border border-outline-variant/30 text-center flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-outline mb-3">
            search_off
          </span>
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-1">
            No matching cars found
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-4">
            Try adjusting your search criteria, selecting a different city, or clearing the body type filter.
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
              <article
                key={car.id}
                className="car-listing-card group flex flex-col rounded-[14px] bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/30 overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer"
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
                    <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary font-label-sm text-label-sm font-semibold tracking-wide flex items-center gap-1 shadow-sm">
                      <span className="material-symbols-outlined text-sm leading-none text-primary">
                        verified
                      </span>
                      Verified {car.inspectionScore}
                    </div>
                  )}

                  {/* Favorite Heart Button */}
                  <button
                    aria-label="Save to favorites"
                    type="button"
                    onClick={(e) => {
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
