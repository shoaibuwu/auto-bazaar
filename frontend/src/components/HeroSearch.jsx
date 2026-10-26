import React, { useState } from "react";
import { cities, budgetOptions, bodyTypes } from "../data/filters";

export default function HeroSearch({
  searchQuery,
  onSearchChange,
  selectedCity,
  onCityChange,
  selectedBudget,
  onBudgetChange,
  selectedBodyType,
  onBodyTypeChange,
  onSearchSubmit
}) {
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchClick = () => {
    setIsSearching(true);
    if (onSearchSubmit) {
      onSearchSubmit();
    }
    setTimeout(() => {
      setIsSearching(false);
    }, 500);
  };

  return (
    <section className="relative w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin pt-12 md:pt-20 pb-12 flex flex-col items-center text-center">
      {/* Subtle Ambient Glow */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-3/4 max-w-3xl h-64 bg-gradient-to-b from-primary-fixed/30 to-transparent blur-3xl pointer-events-none -z-10 rounded-full"></div>

      {/* Live Badge */}
      <div className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-surface-container text-primary font-label-md text-label-md mb-space-md">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
        Direct Certified Inventory Across 5 Metro Hubs
      </div>

      {/* Main H1 Headline */}
      <h1 className="font-display text-display md:text-[44px] md:leading-[52px] font-semibold text-on-surface max-w-3xl tracking-tight mb-space-sm">
        Find verified cars across Pakistan
      </h1>

      <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed mb-space-xl">
        Curated condition reports, verified sellers, and straightforward pricing in PKR.
      </p>

      {/* Unified Elevated Search Component */}
      <div className="w-full max-w-4xl bg-surface-container-lowest rounded-[10px] shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-2 md:p-2.5 flex flex-col md:flex-row items-stretch md:items-center gap-2 border border-outline-variant/30">
        
        {/* Input 1: Make / Model */}
        <div className="flex-1 flex items-center px-3 py-2.5 bg-surface-container-low md:bg-transparent rounded-lg">
          <span className="material-symbols-outlined text-outline text-xl mr-2.5 select-none">
            directions_car
          </span>
          <div className="flex flex-col text-left w-full min-w-0">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-medium" htmlFor="car-query">
              Make / Model
            </label>
            <input
              id="car-query"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="e.g. Civic, Corolla, Sportage..."
              className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none truncate"
            />
          </div>
        </div>

        {/* Segment Divider 1 */}
        <div className="hidden md:block w-px h-10 bg-outline-variant/30"></div>

        {/* Input 2: City Selector */}
        <div className="flex-1 flex items-center px-3 py-2.5 bg-surface-container-low md:bg-transparent rounded-lg">
          <span className="material-symbols-outlined text-outline text-xl mr-2.5 select-none">
            location_on
          </span>
          <div className="flex flex-col text-left w-full min-w-0">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-medium" htmlFor="city-select">
              Location
            </label>
            <select
              id="city-select"
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none cursor-pointer truncate pr-2"
            >
              {cities.map((city) => (
                <option key={city.value} value={city.value}>
                  {city.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Segment Divider 2 */}
        <div className="hidden md:block w-px h-10 bg-outline-variant/30"></div>

        {/* Input 3: Budget */}
        <div className="flex-1 flex items-center px-3 py-2.5 bg-surface-container-low md:bg-transparent rounded-lg">
          <span className="material-symbols-outlined text-outline text-xl mr-2.5 select-none">
            payments
          </span>
          <div className="flex flex-col text-left w-full min-w-0">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-medium" htmlFor="budget-select">
              Budget
            </label>
            <select
              id="budget-select"
              value={selectedBudget}
              onChange={(e) => onBudgetChange(e.target.value)}
              className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none cursor-pointer truncate pr-2"
            >
              {budgetOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          id="search-trigger-btn"
          type="button"
          onClick={handleSearchClick}
          className="h-12 md:h-11 px-6 rounded-[10px] bg-primary hover:opacity-95 text-on-primary font-title text-title flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 mt-1 md:mt-0"
        >
          {isSearching ? (
            <>
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">search</span>
              <span>Find Cars</span>
            </>
          )}
        </button>
      </div>

      {/* Body-Type Filter Chips */}
      <div className="w-full max-w-4xl mt-space-md flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar py-1">
        {bodyTypes.map((type) => {
          const isActive = selectedBodyType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onBodyTypeChange(type.id)}
              className={`shrink-0 px-4 py-2 rounded-full font-label-md text-label-md transition-colors flex items-center gap-1.5 ${
                isActive
                  ? "bg-primary text-on-primary font-semibold shadow-sm"
                  : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low border border-outline-variant/30"
              }`}
            >
              <span className="material-symbols-outlined text-base">{type.icon}</span>
              {type.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
