import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../../api/notifications.api";
import { useSocket } from "../../context/SocketContext";

/**
 * Format relative time (e.g. 12m ago, 2h ago, Yesterday, Oct 24)
 */
function formatRelativeTime(dateString) {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsDropdown({ isOpen, onClose, onOpenPreferences }) {
  const navigate = useNavigate();
  const { unreadNotificationCount, setUnreadNotificationCount, refreshNotificationCount } =
    useSocket();

  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unread' | 'price'
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ all: 0, unread: 0, price: 0 });
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch notifications whenever dropdown opens or tab changes
  const fetchFeed = async (filter = activeTab) => {
    try {
      setLoading(true);
      const res = await getNotifications({ filter, limit: 15 });
      if (res && res.data) {
        setNotifications(res.data);
      }
      if (res && res.counts) {
        setCounts(res.counts);
        if (typeof res.counts.unread === "number") {
          setUnreadNotificationCount(res.counts.unread);
        }
      }
    } catch (err) {
      console.error("Failed to load notifications dropdown feed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFeed(activeTab);
    }
  }, [isOpen, activeTab]);

  // Listen to live notification event from SocketContext
  useEffect(() => {
    const handleLiveNotif = (e) => {
      const newNotif = e.detail;
      if (!newNotif) return;
      setNotifications((prev) => [newNotif, ...prev]);
      setCounts((prev) => ({
        ...prev,
        all: (prev.all || 0) + 1,
        unread: (prev.unread || 0) + 1,
        price: newNotif.type === "PRICE_DROP" ? (prev.price || 0) + 1 : prev.price || 0,
      }));
    };

    window.addEventListener("autobazaar:new_notification", handleLiveNotif);
    return () => {
      window.removeEventListener("autobazaar:new_notification", handleLiveNotif);
    };
  }, []);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Mark all notifications as read
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

  // Mark single notification as read
  const handleMarkSingleRead = async (e, notif) => {
    e.stopPropagation();
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
      console.error("Failed to mark notification read:", err);
    }
  };

  // Click on a notification item to navigate
  const handleItemClick = (notif) => {
    if (!notif.isRead) {
      markNotificationAsRead(notif._id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    }
    onClose();
    if (notif.link) {
      navigate(notif.link);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-[440px] max-w-[440px] bg-surface-container-lowest dark:bg-[#121826] text-on-surface dark:text-[#E6EAF2] border border-outline-variant/40 dark:border-[#263046] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ maxHeight: "calc(100vh - 5rem)" }}
      role="region"
      aria-label="Notifications popover"
    >
      {/* Popover Header */}
      <div className="p-4 bg-surface-container-lowest dark:bg-[#121826] border-b border-outline-variant/20 dark:border-[#263046]/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg text-on-surface dark:text-[#E6EAF2] tracking-tight">
            Notifications
          </h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-500/10 dark:bg-[#1E2347] text-indigo-600 dark:text-[#818CF8] text-xs font-semibold">
            {unreadNotificationCount} New
          </span>
        </div>
        <button
          onClick={handleMarkAllRead}
          type="button"
          className="text-xs text-on-surface-variant dark:text-[#94A3B8] hover:text-primary dark:hover:text-white flex items-center gap-1 transition-colors"
          title="Mark all notifications as read"
        >
          <span className="material-symbols-outlined text-[16px]">done_all</span>
          Mark all as read
        </button>
      </div>

      {/* Filter Segment Pills */}
      <div className="px-4 py-2.5 bg-surface-container-lowest dark:bg-[#121826] border-b border-outline-variant/20 dark:border-[#263046]/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            activeTab === "all"
              ? "bg-[#6366F1] text-white shadow-sm"
              : "bg-surface-container dark:bg-[#1A2132] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container-high dark:hover:bg-[#263046]"
          }`}
        >
          All ({counts.all || notifications.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("unread")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            activeTab === "unread"
              ? "bg-[#6366F1] text-white shadow-sm"
              : "bg-surface-container dark:bg-[#1A2132] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container-high dark:hover:bg-[#263046]"
          }`}
        >
          Unread ({counts.unread || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("price")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            activeTab === "price"
              ? "bg-[#6366F1] text-white shadow-sm"
              : "bg-surface-container dark:bg-[#1A2132] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container-high dark:hover:bg-[#263046]"
          }`}
        >
          Price Drops ({counts.price || 0})
        </button>
      </div>

      {/* Notifications Scrollable Feed */}
      <div className="flex-1 overflow-y-auto max-h-[440px] divide-y divide-outline-variant/20 dark:divide-[#263046]/70">
        {loading && notifications.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-on-surface-variant dark:text-[#94A3B8]">
            <span className="material-symbols-outlined text-3xl animate-spin mb-2 text-primary">
              progress_activity
            </span>
            <p className="text-xs">Loading updates...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center text-on-surface-variant dark:text-[#94A3B8]">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">
              notifications_off
            </span>
            <p className="text-sm font-medium text-on-surface dark:text-white">
              {activeTab === "unread"
                ? "You're all caught up!"
                : activeTab === "price"
                ? "No price drop alerts yet"
                : "No notifications found"}
            </p>
            <p className="text-xs mt-1 text-on-surface-variant dark:text-[#94A3B8] max-w-xs">
              {activeTab === "unread"
                ? "New updates on your city listings and inquiries will appear here."
                : "Favorite cars in your garage to receive instant alerts when sellers drop prices."}
            </p>
          </div>
        ) : (
          notifications.map((notif) => {
            const isUnread = !notif.isRead;
            const carImg =
              notif.data?.carImage ||
              notif.relatedCar?.images?.[0] ||
              (Array.isArray(notif.relatedCar?.images) ? notif.relatedCar.images[0] : null);

            // Derive badge styling
            let badgeBg = "bg-primary/10 text-primary dark:bg-blue-950/60 dark:text-blue-400";
            if (notif.tag === "Price Drop" || notif.type === "PRICE_DROP") {
              badgeBg =
                "bg-emerald-500/10 text-emerald-600 dark:bg-[#052E16] dark:text-[#4ADE80]";
            } else if (notif.tag === "Accepted" || notif.tagType === "emerald") {
              badgeBg =
                "bg-emerald-500/10 text-emerald-600 dark:bg-[#052E16] dark:text-[#4ADE80]";
            } else if (notif.tag === "Inquiry" || notif.tagType === "purple") {
              badgeBg =
                "bg-purple-500/10 text-purple-600 dark:bg-[#1E2347] dark:text-[#818CF8]";
            } else if (notif.tag === "Inspection") {
              badgeBg =
                "bg-sky-500/10 text-sky-600 dark:bg-[#0C2A4A] dark:text-[#38BDF8]";
            }

            return (
              <article
                key={notif._id}
                onClick={() => handleItemClick(notif)}
                className={`p-3.5 sm:p-4 transition-colors duration-150 cursor-pointer flex items-start gap-3 group ${
                  isUnread
                    ? "bg-indigo-50/50 dark:bg-[#161D2E]/80 hover:bg-indigo-50/80 dark:hover:bg-[#1A2132]"
                    : "bg-surface-container-lowest dark:bg-[#121826] hover:bg-surface-container-low dark:hover:bg-[#1A2132]"
                }`}
              >
                {/* Glowing Unread Dot */}
                <div className="pt-1.5 flex-shrink-0 w-2 flex justify-center">
                  {isUnread ? (
                    <span className="w-2 h-2 rounded-full bg-[#6366F1] block shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                  ) : null}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${badgeBg}`}
                    >
                      {notif.tag || "Update"}
                    </span>
                    <span className="text-[11px] text-on-surface-variant dark:text-[#94A3B8]">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <h3 className="font-semibold text-xs sm:text-sm text-on-surface dark:text-[#E6EAF2] group-hover:text-primary dark:group-hover:text-white transition-colors line-clamp-1">
                    {notif.title}
                  </h3>

                  <p className="text-xs text-on-surface-variant dark:text-[#94A3B8] line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>

                  {/* Metadata Row (e.g. City & Price) */}
                  {notif.data?.city && notif.data?.price ? (
                    <div className="flex items-center justify-between mt-1 pt-1 text-[11px] text-on-surface-variant dark:text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">
                          location_on
                        </span>
                        {notif.data.city}
                      </span>
                      <span className="font-bold text-on-surface dark:text-[#E6EAF2]">
                        PKR {Number(notif.data.price).toLocaleString()}
                      </span>
                    </div>
                  ) : null}

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2 mt-2 pt-0.5">
                    {notif.type === "INSPECTION_UPDATE" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(notif);
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#6366F1] hover:bg-[#4F46E5] text-white text-[11px] font-medium transition-colors shadow-sm"
                      >
                        View Appointment
                      </button>
                    )}

                    {(notif.type === "INQUIRY_MESSAGE" || notif.type === "OFFER_RECEIVED") && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(notif);
                        }}
                        className="flex items-center gap-1 text-[#6366F1] dark:text-[#818CF8] hover:underline text-[11px] font-medium"
                      >
                        <span className="material-symbols-outlined text-[14px]">chat</span>
                        Reply to dealer
                      </button>
                    )}

                    {notif.type === "PRICE_DROP" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(notif);
                        }}
                        className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-colors"
                      >
                        View Vehicle
                      </button>
                    )}

                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkSingleRead(e, notif)}
                        className="text-[11px] text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white transition-colors ml-auto"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>

                {/* Car Thumbnail on the right */}
                {carImg && (
                  <div className="w-16 h-16 rounded-lg bg-surface-container dark:bg-[#1A2132] overflow-hidden flex-shrink-0 ml-1 border border-outline-variant/30 dark:border-[#263046]">
                    <img
                      src={carImg}
                      alt={notif.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Popover Footer */}
      <div className="px-4 py-3 bg-surface-container-low dark:bg-[#1A2132]/70 border-t border-outline-variant/20 dark:border-[#263046]/70 flex items-center justify-between">
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-xs font-semibold text-[#6366F1] dark:text-[#818CF8] hover:underline flex items-center gap-1 transition-colors"
        >
          View all notifications
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </Link>

        {onOpenPreferences && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPreferences();
            }}
            title="Notification Settings & Preferences"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-white hover:bg-surface-container dark:hover:bg-[#263046] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
        )}
      </div>
    </div>
  );
}

