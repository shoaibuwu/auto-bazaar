import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearReadNotifications,
  deleteNotification,
} from "../api/notifications.api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

/**
 * Format relative time (e.g. 14 mins ago, 1 hour ago, Yesterday, Oct 22)
 */
function formatNotificationDate(dateString) {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { unreadNotificationCount, setUnreadNotificationCount } = useSocket();

  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unread' | 'price' | 'inspection' | 'chat'
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    unread: 0,
    price: 0,
    inspection: 0,
    chat: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [clearingRead, setClearingRead] = useState(false);

  // User Notification Preferences state (persisted to localStorage)
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem("autobazaar_notification_preferences");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      priceDrops: true,
      cityMatches: true,
      chatMessages: true,
      inspectionUpdates: true,
    };
  });

  const handleTogglePreference = (key) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(
          "autobazaar_notification_preferences",
          JSON.stringify(updated)
        );
      } catch {}
      return updated;
    });
  };

  const loadNotifications = useCallback(
    async (filter = activeTab) => {
      if (!isAuthenticated) return;
      try {
        setLoading(true);
        const res = await getNotifications({ filter, limit: 50 });
        if (res?.data) {
          setNotifications(res.data);
        }
        if (res?.counts) {
          setCounts(res.counts);
          if (typeof res.counts.unread === "number") {
            setUnreadNotificationCount(res.counts.unread);
          }
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, activeTab, setUnreadNotificationCount]
  );

  useEffect(() => {
    loadNotifications(activeTab);
  }, [loadNotifications, activeTab]);

  // Listen to live socket events dispatched from SocketContext
  useEffect(() => {
    const handleNewNotif = (e) => {
      const newNotif = e.detail;
      if (!newNotif) return;
      setNotifications((prev) => [newNotif, ...prev]);
      setCounts((prev) => ({
        ...prev,
        all: (prev.all || 0) + 1,
        unread: (prev.unread || 0) + 1,
        price: newNotif.type === "PRICE_DROP" ? (prev.price || 0) + 1 : prev.price || 0,
        inspection:
          newNotif.type === "INSPECTION_UPDATE"
            ? (prev.inspection || 0) + 1
            : prev.inspection || 0,
        chat:
          newNotif.type === "INQUIRY_MESSAGE" || newNotif.type === "OFFER_RECEIVED"
            ? (prev.chat || 0) + 1
            : prev.chat || 0,
      }));
    };

    window.addEventListener("autobazaar:new_notification", handleNewNotif);
    return () => {
      window.removeEventListener("autobazaar:new_notification", handleNewNotif);
    };
  }, []);

  // Mark single notification read
  const handleMarkRead = async (notif) => {
    if (notif.isRead) return;
    try {
      await markNotificationAsRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setCounts((prev) => ({
        ...prev,
        unread: Math.max(0, (prev.unread || 1) - 1),
      }));
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
      );
      setCounts((prev) => ({ ...prev, unread: 0 }));
      setUnreadNotificationCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Clear all read notifications
  const handleClearRead = async () => {
    try {
      setClearingRead(true);
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      setCounts((prev) => ({
        ...prev,
        all: prev.unread || 0,
      }));
    } catch (err) {
      console.error("Failed to clear read notifications:", err);
    } finally {
      setClearingRead(false);
    }
  };

  // Delete single notification
  const handleDeleteNotification = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setActiveMenuId(null);
      loadNotifications(activeTab);
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  // Close card 3-dots menus when clicking outside
  useEffect(() => {
    const handleOutside = () => setActiveMenuId(null);
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">notifications</span>
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-2">Sign in to View Notifications</h1>
        <p className="text-on-surface-variant max-w-md mx-auto mb-6 text-sm">
          Get real-time alerts when cars drop in price, when sellers reply, or when new cars are
          listed in your city.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow hover:opacity-90 transition-all"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-[#0B0F1A] text-on-surface dark:text-[#E6EAF2] pt-6 pb-20">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-on-surface-variant dark:text-[#94A3B8] mb-4">
          <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">home</span>
            Home
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface dark:text-[#E6EAF2] font-medium">Notifications</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-outline-variant/30 dark:border-[#1E2638]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface dark:text-[#E6EAF2]">
                Notifications
              </h1>
              {unreadNotificationCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 dark:bg-[#1E2347] text-indigo-600 dark:text-[#818CF8] border border-indigo-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  {unreadNotificationCount} unread
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8]">
              Stay updated on price drops, 200-point inspection reports, and verified seller responses
              across Pakistan.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-outline-variant/50 dark:border-[#263046] bg-surface-container-lowest dark:bg-[#121826] hover:bg-surface-container dark:hover:bg-[#1A2132] text-on-surface dark:text-[#E6EAF2] transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-500">done_all</span>
              Mark all as read
            </button>

            <button
              type="button"
              onClick={() => setIsPreferencesOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              Notification Settings
            </button>
          </div>
        </div>

        {/* Filter Segment Tabs */}
        <div className="flex items-center gap-2 py-4 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
              activeTab === "all"
                ? "bg-[#4F46E5] text-white shadow"
                : "bg-surface-container-low dark:bg-[#121826] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container dark:hover:bg-[#1A2132]"
            }`}
          >
            All Notifications
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "all"
                  ? "bg-white/20 text-white"
                  : "bg-outline-variant/30 dark:bg-[#1E2638] text-on-surface-variant dark:text-[#94A3B8]"
              }`}
            >
              {counts.all || notifications.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
              activeTab === "unread"
                ? "bg-[#4F46E5] text-white shadow"
                : "bg-surface-container-low dark:bg-[#121826] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container dark:hover:bg-[#1A2132]"
            }`}
          >
            Unread
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "unread"
                  ? "bg-white/20 text-white"
                  : "bg-outline-variant/30 dark:bg-[#1E2638] text-on-surface-variant dark:text-[#94A3B8]"
              }`}
            >
              {counts.unread || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("price")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
              activeTab === "price"
                ? "bg-[#4F46E5] text-white shadow"
                : "bg-surface-container-low dark:bg-[#121826] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container dark:hover:bg-[#1A2132]"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">trending_down</span>
            Price Alerts
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "price"
                  ? "bg-white/20 text-white"
                  : "bg-outline-variant/30 dark:bg-[#1E2638] text-on-surface-variant dark:text-[#94A3B8]"
              }`}
            >
              {counts.price || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("inspection")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
              activeTab === "inspection"
                ? "bg-[#4F46E5] text-white shadow"
                : "bg-surface-container-low dark:bg-[#121826] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container dark:hover:bg-[#1A2132]"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">verified</span>
            Inspections
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "inspection"
                  ? "bg-white/20 text-white"
                  : "bg-outline-variant/30 dark:bg-[#1E2638] text-on-surface-variant dark:text-[#94A3B8]"
              }`}
            >
              {counts.inspection || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
              activeTab === "chat"
                ? "bg-[#4F46E5] text-white shadow"
                : "bg-surface-container-low dark:bg-[#121826] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container dark:hover:bg-[#1A2132]"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">forum</span>
            Bookings & Chat
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "chat"
                  ? "bg-white/20 text-white"
                  : "bg-outline-variant/30 dark:bg-[#1E2638] text-on-surface-variant dark:text-[#94A3B8]"
              }`}
            >
              {counts.chat || 0}
            </span>
          </button>
        </div>

        {/* Notifications Feed Stack */}
        <div className="mt-2 space-y-3">
          {loading && notifications.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl animate-spin text-primary mb-3">
                progress_activity
              </span>
              <p className="text-sm font-medium">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 bg-surface-container-lowest dark:bg-[#121826] rounded-2xl border border-outline-variant/30 dark:border-[#1E2638] flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-3xl">notifications_none</span>
              </div>
              <h3 className="text-base font-semibold text-on-surface dark:text-[#E6EAF2]">
                No notifications in this view
              </h3>
              <p className="text-xs text-on-surface-variant dark:text-[#94A3B8] max-w-sm mt-1">
                {activeTab === "unread"
                  ? "Great job! You have read all your notifications."
                  : activeTab === "price"
                  ? "Save cars you like to your favorites to get notified immediately when prices decrease."
                  : "New updates about vehicles, inspections, and buyer/seller messages will appear here."}
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.isRead;
              const carImg =
                notif.data?.carImage ||
                notif.relatedCar?.images?.[0] ||
                (Array.isArray(notif.relatedCar?.images) ? notif.relatedCar.images[0] : null);

              // Category visual badge styling
              let badgeColor =
                "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400";
              if (notif.type === "PRICE_DROP") {
                badgeColor =
                  "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20";
              } else if (notif.type === "INSPECTION_UPDATE") {
                badgeColor =
                  "bg-sky-500/10 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-500/20";
              } else if (
                notif.type === "INQUIRY_MESSAGE" ||
                notif.type === "OFFER_RECEIVED"
              ) {
                badgeColor =
                  "bg-purple-500/10 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-500/20";
              }

              return (
                <div
                  key={notif._id}
                  onClick={() => handleMarkRead(notif)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all relative flex flex-col sm:flex-row items-start gap-4 ${
                    isUnread
                      ? "bg-indigo-50/40 dark:bg-[#141B2D] border-indigo-200/80 dark:border-indigo-900/60 shadow-sm"
                      : "bg-surface-container-lowest dark:bg-[#111724] border-outline-variant/30 dark:border-[#1E2638] hover:border-outline-variant/60"
                  }`}
                >
                  {/* Left Column: Visual Icon / Thumbnail */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Unread Glowing Dot */}
                    <div className="w-2 flex justify-center">
                      {isUnread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#6366F1] block shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      )}
                    </div>

                    {/* Thumbnail or Category Box */}
                    {carImg ? (
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-surface-container dark:bg-[#1A2132] overflow-hidden border border-outline-variant/30 dark:border-[#263046]">
                        <img
                          src={carImg}
                          alt={notif.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        {notif.data?.year && (
                          <span className="absolute bottom-1 right-1 px-1 rounded bg-black/70 text-[9px] font-bold text-white leading-tight">
                            {notif.data.year}
                          </span>
                        )}
                      </div>
                    ) : notif.type === "INSPECTION_UPDATE" ? (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-sky-500/10 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center border border-sky-500/20">
                        <span className="material-symbols-outlined text-2xl">event_available</span>
                      </div>
                    ) : notif.type === "INQUIRY_MESSAGE" || notif.type === "OFFER_RECEIVED" ? (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base relative shadow-sm">
                        {notif.data?.senderName ? notif.data.senderName.slice(0, 2).toUpperCase() : "UA"}
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#4F46E5] text-white flex items-center justify-center text-[10px] border-2 border-surface dark:border-[#141B2D]">
                          <span className="material-symbols-outlined text-[11px]">chat</span>
                        </span>
                      </div>
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                        <span className="material-symbols-outlined text-2xl">notifications</span>
                      </div>
                    )}
                  </div>

                  {/* Middle Column: Details & Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}
                        >
                          {notif.type === "PRICE_DROP" && (
                            <span className="material-symbols-outlined text-[13px]">
                              arrow_downward
                            </span>
                          )}
                          {notif.tag || "Notification"}
                        </span>

                        {notif.data?.priceDiff ? (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            ↓ PKR {(notif.data.priceDiff / 1000).toLocaleString()}k Drop
                          </span>
                        ) : null}
                      </div>

                      {/* Right Meta & 3-dots Menu */}
                      <div className="flex items-center gap-2 relative">
                        <span className="text-xs text-on-surface-variant dark:text-[#94A3B8]">
                          {formatNotificationDate(notif.createdAt)}
                        </span>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === notif._id ? null : notif._id);
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface dark:hover:text-white hover:bg-surface-container dark:hover:bg-[#1A2132] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>

                          {activeMenuId === notif._id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-8 w-44 p-1.5 bg-surface-container-lowest dark:bg-[#161D2E] rounded-xl border border-outline-variant/30 dark:border-[#263046] shadow-xl z-20 animate-in fade-in zoom-in-95 duration-100"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  handleMarkRead(notif);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface dark:text-[#E6EAF2] hover:bg-surface-container dark:hover:bg-[#1E2638] transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {notif.isRead ? "mark_email_unread" : "done"}
                                </span>
                                {notif.isRead ? "Mark as unread" : "Mark as read"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteNotification(notif._id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notification Title & Highlighted Message */}
                    <div className="mt-1">
                      <p className="text-sm font-semibold text-on-surface dark:text-[#E6EAF2] leading-snug">
                        {notif.title}
                      </p>

                      {notif.type === "PRICE_DROP" && notif.data?.oldPrice && notif.data?.newPrice ? (
                        <p className="text-xs text-on-surface-variant dark:text-[#94A3B8] mt-1">
                          {notif.data.carTitle || "Vehicle"} dropped to{" "}
                          <span className="font-bold text-on-surface dark:text-white">
                            PKR {Number(notif.data.newPrice).toLocaleString()}
                          </span>{" "}
                          <span className="line-through opacity-70">
                            PKR {Number(notif.data.oldPrice).toLocaleString()}
                          </span>{" "}
                          by {notif.data.sellerName || "Seller"}
                          {notif.data.city ? `, ${notif.data.city}` : ""}.
                        </p>
                      ) : notif.type === "INQUIRY_MESSAGE" && notif.data?.previewText ? (
                        <div className="mt-1.5 p-2 rounded-lg bg-surface-container dark:bg-[#1A2132] border border-outline-variant/20 dark:border-[#263046]/50 text-xs text-on-surface-variant dark:text-[#94A3B8]">
                          <span className="font-semibold text-on-surface dark:text-white">
                            {notif.data.senderName || "Seller"}:
                          </span>{" "}
                          “{notif.data.previewText}”
                        </div>
                      ) : (
                        <p className="text-xs text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                          {notif.message}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-wrap items-center gap-3 mt-3 pt-1">
                      {/* Price Drop Actions */}
                      {notif.type === "PRICE_DROP" && (
                        <>
                          <button
                            type="button"
                            onClick={() => notif.link && navigate(notif.link)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-high dark:bg-[#1E2638] hover:bg-surface-container dark:hover:bg-[#263046] text-on-surface dark:text-white transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                            View Vehicle
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(notif.link || "/cars")}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[15px]">call</span>
                            Contact Seller
                          </button>
                        </>
                      )}

                      {/* Inspection Actions */}
                      {notif.type === "INSPECTION_UPDATE" && (
                        <>
                          {notif.data?.isCompleted ? (
                            <>
                              <button
                                type="button"
                                onClick={() => navigate("/inspections")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-high dark:bg-[#1E2638] hover:bg-surface-container dark:hover:bg-[#263046] text-on-surface dark:text-white transition-colors"
                              >
                                <span className="material-symbols-outlined text-[15px]">
                                  picture_as_pdf
                                </span>
                                Download Report (PDF)
                              </button>

                              <button
                                type="button"
                                onClick={() => navigate("/inspections")}
                                className="text-xs font-semibold text-[#6366F1] dark:text-[#818CF8] hover:underline flex items-center gap-1"
                              >
                                View Checklist →
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate("/inspections")}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                calendar_today
                              </span>
                              View Appointment Details
                            </button>
                          )}
                        </>
                      )}

                      {/* Chat / Inquiry Actions */}
                      {(notif.type === "INQUIRY_MESSAGE" || notif.type === "OFFER_RECEIVED") && (
                        <button
                          type="button"
                          onClick={() => navigate(notif.link || "/inquiries")}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[15px]">reply</span>
                          Reply in Chat
                        </button>
                      )}

                      {/* City Match Action */}
                      {notif.type === "CITY_MATCH" && (
                        <button
                          type="button"
                          onClick={() => notif.link && navigate(notif.link)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-high dark:bg-[#1E2638] hover:bg-surface-container dark:hover:bg-[#263046] text-on-surface dark:text-white transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">search</span>
                          View Match
                        </button>
                      )}

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(notif)}
                          className="text-xs text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white transition-colors ml-auto"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Bar Info & Clear Read Actions */}
        <div className="mt-8 pt-4 border-t border-outline-variant/30 dark:border-[#1E2638] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant dark:text-[#94A3B8]">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span>Showing last 30 days of notifications • Auto-cleared after 60 days</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPreferencesOpen(true)}
              className="hover:text-on-surface dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              Preferences
            </button>

            <button
              type="button"
              disabled={clearingRead}
              onClick={handleClearRead}
              className="hover:text-rose-500 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
              {clearingRead ? "Clearing..." : "Clear Read"}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Preferences Modal */}
      {isPreferencesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface-container-lowest dark:bg-[#121826] text-on-surface dark:text-[#E6EAF2] rounded-2xl border border-outline-variant/40 dark:border-[#263046] shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 dark:border-[#1E2638]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">tune</span>
                <h3 className="text-lg font-bold text-on-surface dark:text-white">
                  Notification Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreferencesOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface dark:hover:text-white hover:bg-surface-container dark:hover:bg-[#1A2132]"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant dark:text-[#94A3B8] my-4 leading-relaxed">
              Configure which alerts trigger live notifications in your header bell and notifications
              feed.
            </p>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container dark:bg-[#1A2132] cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface dark:text-white">
                    Price Drops
                  </span>
                  <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8]">
                    Alerts when a favorited vehicle drops in price
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.priceDrops}
                  onChange={() => handleTogglePreference("priceDrops")}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container dark:bg-[#1A2132] cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface dark:text-white">
                    City Matches
                  </span>
                  <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8]">
                    New cars listed in your city ({user?.city || "Your City"})
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.cityMatches}
                  onChange={() => handleTogglePreference("cityMatches")}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container dark:bg-[#1A2132] cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface dark:text-white">
                    Chat & Offers
                  </span>
                  <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8]">
                    Buyer messages, seller responses, and price offers
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.chatMessages}
                  onChange={() => handleTogglePreference("chatMessages")}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container dark:bg-[#1A2132] cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface dark:text-white">
                    Doorstep Inspections
                  </span>
                  <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8]">
                    Booking confirmations and completed diagnostic scorecards
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.inspectionUpdates}
                  onChange={() => handleTogglePreference("inspectionUpdates")}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPreferencesOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

