import React, { useState, useEffect, useMemo, useCallback } from "react";
import HeroSearch from "../components/home/HeroSearch";
import FeaturedCars from "../components/home/FeaturedCars";
import HowItWorks from "../components/home/HowItWorks";
import StatsSection from "../components/home/StatsSection";
import { getPublishedCars } from "../api/cars.api";
import { budgetOptions } from "../data/filters";

export default function HomePage({ favorites = new Set(), onToggleFavorite }) {
  // Inventory state
  const [cars, setCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedBudget, setSelectedBudget] = useState("any");
  const [selectedBodyType, setSelectedBodyType] = useState("all");

  // Load published cars from database
  const loadCars = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getPublishedCars();
      setCars(data);
    } catch (err) {
      console.warn("Could not fetch cars from database:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCity("all");
    setSelectedBudget("any");
    setSelectedBodyType("all");
  };

  // Filter cars dynamically
  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      // 1. Query filter (Make / Model / Fuel / City)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          car.title.toLowerCase().includes(q) ||
          car.fuel.toLowerCase().includes(q) ||
          car.city.toLowerCase().includes(q);
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
          if (car.price < 10000000) return false;
        } else if (selectedBodyType === "hybrid") {
          if (!car.fuel.toLowerCase().includes("hybrid") && !car.fuel.toLowerCase().includes("electric")) {
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
  }, [cars, searchQuery, selectedCity, selectedBudget, selectedBodyType]);

  return (
    <div className="flex flex-col w-full">
      {/* Hero & Search Filter */}
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

      {/* Featured Inventory Grid */}
      <FeaturedCars
        cars={filteredCars}
        favorites={favorites}
        isLoading={isLoading}
        onToggleFavorite={onToggleFavorite}
        onResetFilters={handleResetFilters}
      />

      {/* How AutoBazaar Works */}
      <HowItWorks />

      {/* Platform Metrics */}
      <StatsSection />
    </div>
  );
}
