import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminHeader({
  activeTab = "listings",
  searchQuery = "",
  onSearchChange,
  isDarkMode = true,
  onToggleTheme,
}) {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabTitles = {
    dashboard: "Platform Overview",
    listings: "Listings Moderation Queue",
    users: "User Registry & KYC Desk",
    reports: "Marketplace Reports",
    "audit-log": "System Audit Log",
    "system-settings": "Console Settings",
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white/90 dark:bg-[#0B0F1A]/90 backdrop-blur-xl border-b border-slate-200 dark:border-[#263046] shadow-sm z-40 flex items-center justify-between px-6 transition-colors duration-200">
      
      {/* Left: Breadcrumbs & Feed Health Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            Admin Console
          </span>
          <span className="material-symbols-outlined text-[15px] text-slate-400 dark:text-slate-500">
            chevron_right
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
            {tabTitles[activeTab] || activeTab}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-[#263046] text-indigo-600 dark:text-indigo-400 text-[11px] font-medium transition-colors">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
          <span>Punjab & Sindh Feeds Active</span>
        </div>
      </div>

      {/* Right: Search, Theme, Notifications & Admin Avatar Dropdown */}
      <div className="flex items-center gap-3">
        
        {/* Search input with ⌘K badge */}
        <div className="relative hidden sm:flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Search listings, VIN, or seller..."
            className="h-9 pl-9 pr-9 rounded-lg bg-slate-50 dark:bg-[#121826] border border-slate-200 dark:border-[#263046] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-56 lg:w-72 transition-all font-mono shadow-sm"
          />
          <kbd className="absolute right-2.5 text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#162032] border border-slate-300 dark:border-[#263046]">
            ⌘K
          </kbd>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#161F30] border border-transparent hover:border-slate-200 dark:hover:border-[#263046] transition-all"
        >
          <span className="material-symbols-outlined text-[19px]">
            {isDarkMode ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#161F30] border border-transparent hover:border-slate-200 dark:hover:border-[#263046] relative transition-all"
        >
          <span className="material-symbols-outlined text-[19px]">
            notifications
          </span>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500"></span>
        </button>

        {/* Superuser Profile Pill with Dropdown Menu */}
        <div className="relative pl-2 border-l border-slate-200 dark:border-[#263046]" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-[#161F30] transition-colors focus:outline-none"
            aria-label="Admin Profile Menu"
          >
            <div className="hidden lg:flex flex-col items-end leading-tight text-right">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {user?.name || "Platform Admin"}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Karachi & Lahore Desk
              </span>
            </div>

            <div className="relative w-8 h-8 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-inner ring-2 ring-indigo-500/30">
              {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0B0F1A]"></span>
            </div>
            
            <span className="material-symbols-outlined text-slate-400 text-sm hidden sm:inline">
              expand_more
            </span>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-12 w-60 p-2 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-[#263046] shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-50 transition-colors">
              
              {/* Header Info */}
              <div className="px-3 py-2 border-b border-slate-100 dark:border-[#1C263A]">
                <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                  {user?.name || "AutoBazaar Admin"}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                  {user?.email || "admin@autobazaar.com"}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    {user?.role || "admin"}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    • Verified
                  </span>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="py-1">
                <Link
                  to="/"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161F30] rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-500 dark:text-slate-400">
                    storefront
                  </span>
                  Public Marketplace
                </Link>

                <Link
                  to="/sell?tab=listings"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161F30] rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-500 dark:text-slate-400">
                    garage
                  </span>
                  My Seller Listings
                </Link>

                <Link
                  to="/inquiries"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161F30] rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-500 dark:text-slate-400">
                    forum
                  </span>
                  Inquiries & Messages
                </Link>
              </div>

              {/* Sign Out Button */}
              <div className="pt-1 border-t border-slate-100 dark:border-[#1C263A]">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    logout
                  </span>
                  Sign Out of Console
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

    </header>
  );
}
