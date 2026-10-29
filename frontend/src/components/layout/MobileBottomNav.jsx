import React from "react";

export default function MobileBottomNav({ favoritesCount = 3, activeTab = "browse", onTabChange }) {
  const navItems = [
    { id: "browse", label: "Browse", icon: "directions_car" },
    { id: "sell", label: "Sell", icon: "add_circle" },
    { id: "inspection", label: "Inspection", icon: "verified_user" },
    { id: "saved", label: "Saved", icon: "favorite", hasBadge: true },
    { id: "account", label: "Account", icon: "person" }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/30 px-space-md flex items-center justify-around">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange && onTabChange(item.id)}
            className={`relative flex flex-col items-center justify-center transition-colors ${
              isActive ? "text-primary font-semibold" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <div className="relative">
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.hasBadge && favoritesCount > 0 && (
                <span className="absolute -top-1 -right-2 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-on-primary font-label-sm text-[9px] font-semibold leading-none">
                  {favoritesCount}
                </span>
              )}
            </div>
            <span className="font-label-sm text-label-sm mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
