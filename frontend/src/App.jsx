import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import AuthModal from "./components/auth/AuthModal";
import HomePage from "./pages/HomePage";
import CarDetailsPage from "./pages/CarDetailsPage";
import SellCarPage from "./pages/SellCarPage";
import AdminModerationPage from "./pages/AdminModerationPage";
import InquiriesPage from "./pages/InquiriesPage";
import InspectionsPage from "./pages/InspectionsPage";
import { useAuth } from "./context/AuthContext";
import { toggleFavoriteCar, getUserFavorites } from "./api/cars.api";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Check if current route is within Admin console
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Theme state initialized from localStorage or system preference
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("autobazaar_theme");
    if (saved) return saved === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Keep <html> element classes and localStorage in sync whenever isDarkMode changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      root.classList.remove("light");
      localStorage.setItem("autobazaar_theme", "dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      localStorage.setItem("autobazaar_theme", "light");
    }
  }, [isDarkMode]);

  // Pure toggle handler
  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Favorites state (Set of favorited car ObjectIds)
  const [favorites, setFavorites] = useState(new Set());

  // Active mobile bottom nav tab
  const [activeMobileTab, setActiveMobileTab] = useState("browse");

  // Keep mobile bottom nav tab highlighted for current route
  useEffect(() => {
    if (location.pathname === "/sell") setActiveMobileTab("sell");
    else if (location.pathname === "/inspections") setActiveMobileTab("inspection");
    else if (location.pathname === "/") setActiveMobileTab("browse");
  }, [location.pathname]);

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
    } else if (tabId === "inspection") {
      navigate("/inspections");
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
    <div className={`font-body-md antialiased min-h-screen flex flex-col transition-colors duration-200 ${isAdminRoute ? "bg-slate-50 dark:bg-[#0B0F1A] text-slate-800 dark:text-slate-200" : "bg-background text-on-surface"}`}>
      {/* Consumer Header (Hidden on Admin Console) */}
      {!isAdminRoute && (
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
      )}

      {/* Main Content Area */}
      <main className={`w-full min-h-screen flex-1 transition-colors duration-200 ${isAdminRoute ? "" : "pt-16 pb-16 md:pb-0 bg-background"}`}>
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
          <Route
            path="/admin"
            element={
              <AdminModerationPage
                onOpenAuth={() => setIsAuthModalOpen(true)}
                isDarkMode={isDarkMode}
                onToggleTheme={handleToggleTheme}
              />
            }
          />
          <Route
            path="/inquiries"
            element={<InquiriesPage onOpenAuth={() => setIsAuthModalOpen(true)} />}
          />
          <Route
            path="/inspections"
            element={
              <InspectionsPage
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onOpenAuth={() => setIsAuthModalOpen(true)}
              />
            }
          />
        </Routes>
      </main>

      {/* Consumer Footer (Hidden on Admin Console) */}
      {!isAdminRoute && <Footer />}

      {/* Mobile Bottom Navigation (Hidden on Admin Console) */}
      {!isAdminRoute && (
        <MobileBottomNav
          favoritesCount={favorites.size}
          activeTab={activeMobileTab}
          onTabChange={handleMobileNavChange}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
