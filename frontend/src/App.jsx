import React, { useState, useEffect, useCallback, useRef } from "react";
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
import SavedCarsPage from "./pages/SavedCarsPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import { useAuth } from "./context/AuthContext";
import { toggleFavoriteCar, getUserFavorites } from "./api/cars.api";

const GUEST_FAVORITES_KEY = "autobazaar_guest_favorites";

const getMobileTabForPath = (pathname) => {
  if (pathname === "/sell") return "sell";
  if (pathname === "/inspections") return "inspection";
  if (pathname === "/saved") return "saved";
  if (pathname === "/profile") return "account";
  if (pathname === "/") return "browse";
  return "";
};

const readGuestFavorites = () => {
  try {
    const raw = localStorage.getItem(GUEST_FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter(Boolean)) : new Set();
  } catch {
    return new Set();
  }
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

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

  // Favorites state (Set of favorited car ObjectIds) + sync coordination
  const [favorites, setFavorites] = useState(readGuestFavorites);
  const [isFavoritesSyncing, setIsFavoritesSyncing] = useState(true);
  const [favoritesSyncVersion, setFavoritesSyncVersion] = useState(0);
  const pendingFavIdsRef = useRef(new Set());

  // Active mobile bottom nav tab
  const [activeMobileTab, setActiveMobileTab] = useState(
    () => getMobileTabForPath(location.pathname) || "browse"
  );

  // Keep mobile bottom nav tab highlighted for current route
  useEffect(() => {
    setActiveMobileTab(getMobileTabForPath(location.pathname));
  }, [location.pathname]);

  // Sync user favorites from MongoDB when logged in (merging any guest favorites first),
  // or load guest storage when logged out — always waiting for auth check to settle first
  const loadUserFavorites = useCallback(async () => {
    if (authLoading) {
      setIsFavoritesSyncing(true);
      return;
    }

    if (!isAuthenticated) {
      setFavorites(readGuestFavorites());
      setFavoritesSyncVersion((v) => v + 1);
      setIsFavoritesSyncing(false);
      return;
    }

    setIsFavoritesSyncing(true);
    try {
      const existingFavIds = await getUserFavorites();
      const syncedSet = new Set(existingFavIds);

      // Merge any cars saved during guest browsing into MongoDB account once after sign-in
      const guestSet = readGuestFavorites();
      const toMerge = Array.from(guestSet).filter((id) => !syncedSet.has(id));
      if (toMerge.length > 0) {
        const results = await Promise.allSettled(
          toMerge.map((id) => toggleFavoriteCar(id))
        );
        results.forEach((result, idx) => {
          if (result.status === "fulfilled" && result.value?.success && result.value?.data?.isFavorited) {
            syncedSet.add(toMerge[idx]);
          }
        });
        try {
          localStorage.removeItem(GUEST_FAVORITES_KEY);
        } catch {}
      }

      setFavorites(syncedSet);
    } catch (err) {
      console.warn("Could not load user favorites:", err.message);
    } finally {
      setFavoritesSyncVersion((v) => v + 1);
      setIsFavoritesSyncing(false);
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    loadUserFavorites();
  }, [loadUserFavorites]);

  // Toggle favorite car (returns true on success, false if failed)
  const handleToggleFavorite = async (carId) => {
    if (!carId || pendingFavIdsRef.current.has(carId)) {
      return false;
    }

    if (isAuthenticated) {
      pendingFavIdsRef.current.add(carId);
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
          return true;
        }
        return false;
      } catch (err) {
        console.warn("Favorite API toggle failed:", err.message);
        if (err.statusCode === 401) {
          setIsAuthModalOpen(true);
        }
        return false;
      } finally {
        pendingFavIdsRef.current.delete(carId);
      }
    }

    // Local storage fallback (for visitors)
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) {
        next.delete(carId);
      } else {
        next.add(carId);
      }
      try {
        localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    return true;
  };

  // Focus homepage search bar from any route (Header button or Ctrl/Cmd+K)
  const handleOpenSearch = useCallback(() => {
    const input = document.getElementById("car-query");
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus();
      return;
    }
    navigate("/");
    setTimeout(() => {
      const target = document.getElementById("car-query");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus();
      }
    }, 150);
  }, [navigate]);

  useEffect(() => {
    if (isAdminRoute) return;
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        handleOpenSearch();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isAdminRoute, handleOpenSearch]);

  // Mobile Bottom Navigation handler
  const handleMobileNavChange = (tabId) => {
    setActiveMobileTab(tabId);
    if (tabId === "sell") {
      navigate("/sell");
    } else if (tabId === "inspection") {
      navigate("/inspections");
    } else if (tabId === "saved") {
      navigate("/saved");
    } else if (tabId === "account") {
      if (!isAuthenticated) {
        setIsAuthModalOpen(true);
      } else {
        navigate("/profile");
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
          onOpenSearch={handleOpenSearch}
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
          <Route
            path="/saved"
            element={
              <SavedCarsPage
                favorites={favorites}
                isFavoritesSyncing={authLoading || isFavoritesSyncing}
                favoritesSyncVersion={favoritesSyncVersion}
                onToggleFavorite={handleToggleFavorite}
                onOpenAuth={() => setIsAuthModalOpen(true)}
              />
            }
          />
          <Route
            path="/profile"
            element={<ProfilePage onOpenAuth={() => setIsAuthModalOpen(true)} />}
          />
          <Route
            path="/notifications"
            element={<NotificationsPage />}
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
        onClose={() => {
          setIsAuthModalOpen(false);
          setActiveMobileTab(getMobileTabForPath(location.pathname));
        }}
      />
    </div>
  );
}
