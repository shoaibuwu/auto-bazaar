import React from "react";

export default function Header({
  favoritesCount = 3,
  isDarkMode = false,
  onToggleTheme,
  onOpenSearch
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/30 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-16 max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin flex items-center justify-between gap-space-md">
        
        {/* Brand Logo & Country Tag */}
        <div className="flex items-center gap-space-md">
          <a className="flex items-center gap-space-sm" href="#">
            <img
              alt="AutoBazaar Logo"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBcfUurIgcccNjDNUzdETnsj0AL0al6kLVaT_1wzMbitNeUtIoM0D_WaVwygvN_j9OyYYyXPbxlXHGd5-BPnsDqcoPRdGAqgQqySd6seT6VczVasfIkUhnxeMaeEybU-cvFXTkP3vGQU_CJQk_WPNMVy7LzOO-_jxHhBqlAqFzXxv3DB2itYYAMvfi4v2RCwkCMxtByZWhlGESgL6Rdbae640dtoE2mQUhOZSteWqtY3Myz0aqSn9Jc"
            />
            <span className="font-title text-title font-semibold tracking-tight text-on-surface">
              AutoBazaar
            </span>
          </a>
          <span className="hidden lg:inline-flex items-center px-space-xs py-0.5 rounded-full bg-secondary-container/60 text-on-secondary-fixed font-label-sm text-label-sm uppercase tracking-wider font-semibold">
            Pakistan
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-space-xs">
          <a
            aria-current="page"
            className="px-space-md py-space-xs rounded-lg transition-colors bg-surface-container text-primary font-title font-medium"
            href="#browse"
          >
            Browse
          </a>
          <a
            className="px-space-md py-space-xs rounded-lg font-body-md text-body-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
            href="#sell"
          >
            Sell a Car
          </a>
          <a
            className="px-space-md py-space-xs rounded-lg font-body-md text-body-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
            href="#inspection"
          >
            Verified Inspection
          </a>
        </nav>

        {/* Right Action Icons & Profile */}
        <div className="flex items-center gap-space-sm">
          {/* Quick Search Bar Shortcut */}
          <button
            aria-label="Search listings"
            onClick={onOpenSearch}
            className="hidden sm:flex items-center gap-space-sm h-9 px-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:border-outline transition-all shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]"
            type="button"
          >
            <span className="material-symbols-outlined text-lg leading-none">search</span>
            <span className="font-body-sm text-body-sm hidden md:inline text-outline">
              Search cars in Pakistan...
            </span>
            <kbd className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant/40">
              ⌘K
            </kbd>
          </button>

          {/* Saved / Favorites Badge */}
          <a
            aria-label="Saved Cars"
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors"
            href="#favorites"
          >
            <span className="material-symbols-outlined text-xl">favorite</span>
            {favoritesCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary font-label-sm text-[10px] font-semibold leading-none">
                {favoritesCount}
              </span>
            )}
          </a>

          {/* Notifications Button */}
          <button
            aria-label="Notifications"
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-tertiary-container ring-2 ring-surface"></span>
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            aria-label="Toggle dark/light theme"
            onClick={onToggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-outline-variant/50 hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-xl">
              {isDarkMode ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* User Profile Avatar with Online Indicator */}
          <div className="relative flex items-center pl-space-xs">
            <a className="relative flex items-center focus:outline-none" href="#profile">
              <img
                alt="Profile"
                className="w-9 h-9 rounded-full object-cover ring-1 ring-outline-variant/40"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAuc7pOuFw6qZi7zCrY84M8EN3mDsP6JB_wyUWF9hBQZwa1m6KJro8884JMI6p7-NmyVmvHc_hIral4ftfneKPKVR6wH-wjgHD5oXBFsEN3DJGHqajKjC2ik7H8WuA_e6hQsB3quYhnE6v5fWRv3at8JfrnA6Q-L6omVz3wKYkuylvK7XrujRl5P1iHPU0v5BmHdpebDNku1x1cPhAHjnOqzn6oTOs7IvSEEIxQWDO8FbOOD84fpQqu"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface"></span>
            </a>
          </div>
        </div>

      </div>
    </header>
  );
}
