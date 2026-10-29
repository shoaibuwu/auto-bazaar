import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Header({
  favoritesCount = 0,
  isDarkMode = false,
  onToggleTheme,
  onOpenSearch,
  onOpenAuth,
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-colors duration-200">
      <div className="h-16 max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin flex items-center justify-between gap-space-md">
        
        {/* Brand Logo & Country Tag */}
        <div className="flex items-center gap-space-md">
          <Link className="flex items-center gap-2" to="/">
            <span className="material-symbols-outlined text-primary text-28 md:text-32 font-bold select-none">
              directions_car
            </span>
            <span className="font-title text-title font-bold tracking-tight text-on-surface">
              AutoBazaar
            </span>
          </Link>
          <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm uppercase tracking-wider font-semibold border border-outline-variant/30">
            Pakistan
          </span>
        </div>

        {/* Desktop Navigation Links (Pill Bar matching design screenshot) */}
        <nav className="hidden md:flex items-center p-1 rounded-full bg-surface-container/60 border border-outline-variant/30 text-sm">
          <Link
            aria-current="page"
            className="px-4 py-1.5 rounded-full transition-all bg-surface-container-lowest text-on-surface font-semibold shadow-sm"
            to="/"
          >
            Used Cars
          </Link>
          <a
            className="px-4 py-1.5 rounded-full font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            href="#inspections"
          >
            Inspections
          </a>
          <a
            className="px-4 py-1.5 rounded-full font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            href="#sell"
          >
            Sell Your Car
          </a>
          <a
            className="px-4 py-1.5 rounded-full font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            href="#price-guide"
          >
            Price Guide
          </a>
        </nav>

        {/* Right Action Icons & Profile */}
        <div className="flex items-center gap-2">
          {/* Quick Search Bar Shortcut */}
          <button
            aria-label="Search listings"
            onClick={onOpenSearch}
            className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-outline transition-all shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-lg leading-none">search</span>
            <span className="font-body-sm text-body-sm hidden md:inline text-outline">
              Search cars...
            </span>
            <kbd className="font-label-sm text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant/40">
              ⌘K
            </kbd>
          </button>

          {/* Saved / Favorites Badge */}
          <a
            aria-label="Saved Cars"
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
            href="#favorites"
          >
            <span className="material-symbols-outlined text-xl">favorite</span>
            {favoritesCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary font-label-sm text-[10px] font-semibold leading-none shadow-sm">
                {favoritesCount}
              </span>
            )}
          </a>

          {/* Notifications Button */}
          <button
            aria-label="Notifications"
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-surface"></span>
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            aria-label="Toggle dark/light theme"
            onClick={onToggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-outline-variant/50 hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-xl">
              {isDarkMode ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* User Profile / Auth Area */}
          <div className="relative flex items-center pl-1" ref={dropdownRef}>
            {isAuthenticated ? (
              <div>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="relative flex items-center justify-center w-9 h-9 rounded-full bg-primary text-on-primary font-semibold text-sm ring-2 ring-primary/30 hover:opacity-90 transition-all focus:outline-none"
                  aria-label="User menu"
                >
                  {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface"></span>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 top-11 w-56 p-2 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl animate-in fade-in zoom-in-95 duration-150 z-50">
                    <div className="px-3 py-2 border-b border-outline-variant/30">
                      <p className="font-semibold text-sm text-on-surface truncate">{user.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary">
                        {user.role}
                      </span>
                    </div>

                    <div className="py-1">
                      {user.role === "seller" && (
                        <a
                          href="#my-listings"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">garage</span>
                          My Listings
                        </a>
                      )}

                      {user.role === "admin" && (
                        <a
                          href="#admin-panel"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                          Moderation Queue
                        </a>
                      )}

                      <a
                        href="#favorites"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">favorite</span>
                        Saved Cars ({favoritesCount})
                      </a>
                    </div>

                    <div className="pt-1 border-t border-outline-variant/30">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">logout</span>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-on-primary hover:opacity-95 transition-all shadow-sm focus:outline-none"
                aria-label="Sign In"
                title="Sign In"
              >
                <span className="material-symbols-outlined text-xl">person</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
