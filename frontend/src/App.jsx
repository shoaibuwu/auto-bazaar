import React, { useState, useEffect, useMemo } from "react";
import Header from "./components/Header";
import HeroSearch from "./components/HeroSearch";
import FeaturedCars from "./components/FeaturedCars";
import HowItWorks from "./components/HowItWorks";
import StatsSection from "./components/StatsSection";
import Footer from "./components/Footer";
import MobileBottomNav from "./components/MobileBottomNav";
import { mockCars } from "./data/mockCars";
import { budgetOptions } from "./data/filters";

export default function App() {
  // Theme state (Dark/Light mode)
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Favorites state (initialized with 3 items as showcased in the design badge)
  const [favorites, setFavorites] = useState(new Set(["car-1", "car-3", "car-5"]));

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedBudget, setSelectedBudget] = useState("6m");
  const [selectedBodyType, setSelectedBodyType] = useState("all");
  const [activeMobileTab, setActiveMobileTab] = useState("browse");

  // Sync theme with document element
  const handleToggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  };

  // Toggle favorite car
  const handleToggleFavorite = (carId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) {
        next.delete(carId);
      } else {
        next.add(carId);
      }
      return next;
    });
  };

  // Reset all search filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCity("all");
    setSelectedBudget("any");
    setSelectedBodyType("all");
  };

  // Filter cars dynamically
  const filteredCars = useMemo(() => {
    return mockCars.filter((car) => {
      // 1. Query filter (Make / Model)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = car.title.toLowerCase().includes(q) || car.fuel.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // 2. City filter
      if (selectedCity !== "all") {
        if (car.city.toLowerCase() !== selectedCity.toLowerCase()) {
          return false;
        }
      }

      // 3. Body type filter
      if (selectedBodyType !== "all") {
        if (selectedBodyType === "luxury") {
          // Luxury condition: price >= 10,000,000 PKR
          if (car.price < 10000000) return false;
        } else if (selectedBodyType === "hybrid") {
          if (!car.fuel.toLowerCase().includes("hybrid") && !car.fuel.toLowerCase().includes("electric")) {
            // Keep matching fuel if available
            return false;
          }
        } else if (car.bodyType !== selectedBodyType) {
          return false;
        }
      }

      // 4. Budget filter
      const budgetConfig = budgetOptions.find((b) => b.value === selectedBudget);
      if (budgetConfig) {
        if (budgetConfig.max && car.price > budgetConfig.max) {
          return false;
        }
        if (budgetConfig.min && car.price < budgetConfig.min) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, selectedCity, selectedBudget, selectedBodyType]);

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col">
      {/* Fixed Header */}
      <Header
        favoritesCount={favorites.size}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onOpenSearch={() => {
          const input = document.getElementById("car-query");
          if (input) input.focus();
        }}
      />

      {/* Main Content Area */}
      <main className="w-full pt-16 bg-background min-h-screen pb-16 md:pb-0 flex-1">
        <div className="flex flex-col w-full">
          {/* Section 1: Hero & Unified Search */}
          <HeroSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCity={selectedCity}
            onCityChange={setSelectedCity}
            selectedBudget={selectedBudget}
            onBudgetChange={setSelectedBudget}
            selectedBodyType={selectedBodyType}
            onBodyTypeChange={setSelectedBodyType}
            onSearchSubmit={() => {}}
          />

          {/* Section 2: Featured Inventory Grid */}
          <FeaturedCars
            cars={filteredCars}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onResetFilters={handleResetFilters}
          />

          {/* Section 3: How It Works */}
          <HowItWorks />

          {/* Section 4: Platform Guarantee & Metrics */}
          <StatsSection />
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        favoritesCount={favorites.size}
        activeTab={activeMobileTab}
        onTabChange={setActiveMobileTab}
      />
    </div>
  );
}
