import React from "react";
import { Link } from "react-router-dom";

export default function AdminSidebar({
  activeTab = "listings",
  onSelectTab,
  pendingCount = 0,
}) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "listings", label: "Listings", icon: "directions_car", badge: pendingCount > 0 ? pendingCount : null },
    { id: "users", label: "Users & Dealers", icon: "group" },
    { id: "reports", label: "Reports", icon: "analytics" },
    { id: "audit-log", label: "Audit Log", icon: "history_toggle_off" },
    { id: "system-settings", label: "System Settings", icon: "settings" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-[#0B0F1A] border-r border-slate-200 dark:border-[#263046] z-50 flex flex-col justify-between py-4 shadow-xl transition-colors duration-200">
      <div className="flex flex-col gap-6">
        
        {/* Brand & Regional Cluster Tag */}
        <div className="px-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:bg-[#4338CA] transition-colors">
              <span className="material-symbols-outlined text-[20px]">
                directions_car
              </span>
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-[#E6EAF2] tracking-tight">
              AutoBazaar
            </span>
          </Link>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-[#263046] text-slate-600 dark:text-slate-400 font-medium">
            #PK-8820
          </span>
        </div>

        {/* Navigation Section */}
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab && onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#4F46E5] text-white shadow-md shadow-indigo-500/20 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#161F30]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-[19px] ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    isActive
                      ? "bg-white text-indigo-700"
                      : "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Node Cluster Status & Back link */}
      <div className="px-3 flex flex-col gap-2">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121826] border border-slate-200 dark:border-[#263046] flex flex-col gap-1 transition-colors">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Node Cluster PK-01
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Karachi & Lahore Core Gateway
          </span>
        </div>

        <Link
          to="/"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161F30] border border-transparent hover:border-slate-200 dark:hover:border-[#263046] transition-all font-medium"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Return to Marketplace
        </Link>
      </div>
    </aside>
  );
}
