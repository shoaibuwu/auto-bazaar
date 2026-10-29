import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import AuthModal from "./components/auth/AuthModal";
import HomePage from "./pages/HomePage";
import CarDetailsPage from "./pages/CarDetailsPage";
import SellCarPage from "./pages/SellCarPage";
import { useAuth } from "./context/AuthContext";
import { toggleFavoriteCar, getUserFavorites } from "./api/cars.api";

export default function App() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Theme state (Dark/Light mode)
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Favorites state (Set of favorited car ObjectIds)
  const [favorites, setFavorites] = useState(new Set());

  // Active mobile bottom nav tab
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

  // Sync user favorites from MongoDB when logged in
  const loadUserFavorites = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const favIds = await getUserFavorites();
      setFavorites(new Set(favIds));
    } catch (err) {
      console.warn("Could not load user favorites:", err.message);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadUserFavorites();
  }, [loadUserFavorites]);

  // Toggle favorite car
  const handleToggleFavorite = async (carId) => {
    if (isAuthenticated) {
      try {
        const res = await toggleFavoriteCar(carId);
        if (res.success) {
          setFavorites((prev) => {
            const next = new Set(prev);
            if (res.data?.isFavorited) {
              next.add(carId);
            } else {
              next.delete(carId);
            }
            return next;
          });
          return;
        }
      } catch (err) {
        console.warn("Favorite API toggle failed:", err.message);
      }
    }

    // Local state fallback (for visitors)
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

  // Mobile Bottom Navigation handler
  const handleMobileNavChange = (tabId) => {
    setActiveMobileTab(tabId);
    if (tabId === "sell") {
      navigate("/sell");
    } else if (tabId === "account") {
      if (!isAuthenticated) {
        setIsAuthModalOpen(true);
      }
    } else if (tabId === "browse") {
      navigate("/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <Header
        favoritesCount={favorites.size}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onOpenSearch={() => {
          const input = document.getElementById("car-query");
          if (input) input.focus();
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="w-full pt-16 bg-background min-h-screen pb-16 md:pb-0 flex-1 transition-colors duration-200">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />
            }
          />
          <Route
            path="/cars/:id"
            element={
              <CarDetailsPage
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onOpenAuth={() => setIsAuthModalOpen(true)}
              />
            }
          />
          <Route
            path="/sell"
            element={<SellCarPage onOpenAuth={() => setIsAuthModalOpen(true)} />}
          />
        </Routes>
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        favoritesCount={favorites.size}
        activeTab={activeMobileTab}
        onTabChange={handleMobileNavChange}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
