import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserProfile, updateUserProfile, changeUserPassword } from "../api/user.api";
import { cities } from "../data/filters";

export default function ProfilePage({ onOpenAuth }) {
  const navigate = useNavigate();
  const { user, isAuthenticated, isSeller, isAdmin, logout, refreshUser } = useAuth();

  // Active sub-tab: "details" | "security"
  const [activeTab, setActiveTab] = useState("details");

  // Profile data & stats
  const [stats, setStats] = useState({
    favoritesCount: 0,
    listingsCount: 0,
    inquiriesCount: 0,
    inspectionsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Profile edit form fields
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("Lahore");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Load user profile & stats from backend
  const loadProfile = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const data = await getUserProfile();
      if (data?.user) {
        setName(data.user.name || "");
        setPhoneNumber(data.user.phoneNumber || "");
        setCity(data.user.city || "Lahore");
      }
      if (data?.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.warn("Could not load profile:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadProfile();
  }, [loadProfile]);

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!name.trim() || name.trim().length < 2) {
      setProfileError("Full name must be at least 2 characters.");
      return;
    }

    try {
      setIsSavingProfile(true);
      await updateUserProfile({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        city: city.trim(),
      });
      await refreshUser();
      setProfileSuccess("Your profile has been updated successfully.");
      setTimeout(() => setProfileSuccess(""), 4000);
    } catch (err) {
      if (err.errors && err.errors.length > 0) {
        const errorDetails = err.errors.map((item) => item.message || item.field).join(". ");
        setProfileError(errorDetails);
      } else {
        setProfileError(err.message || "Failed to update profile.");
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password cannot be the same as your current password.");
      return;
    }

    try {
      setIsChangingPassword(true);
      await changeUserPassword({ currentPassword, newPassword });
      setPasswordSuccess("Your password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(""), 4000);
    } catch (err) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Unauthenticated State
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-4xl">person</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-on-surface">
            Sign In to Manage Your Account
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
            Access your contact details, saved garage, seller listings, and negotiation chats in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenAuth && onOpenAuth()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary text-xs sm:text-sm font-semibold shadow-md hover:opacity-95 transition-opacity"
        >
          <span className="material-symbols-outlined text-base">login</span>
          Sign In or Register
        </button>
      </div>
    );
  }

  // Format member join date
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-PK", {
        month: "short",
        year: "numeric",
      })
    : "Recently joined";

  return (
    <div className="w-full max-w-5xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8 md:py-12 space-y-8">
      {/* Top Banner / User Hero */}
      <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary text-on-primary font-bold text-2xl sm:text-3xl flex items-center justify-center shadow-md ring-4 ring-primary/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-surface" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight truncate">
                {user?.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                  user?.role === "seller"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                    : user?.role === "admin"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                    : "bg-primary/10 text-primary border-primary/25"
                }`}
              >
                {user?.role} Account
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant truncate">
              {user?.email}
            </p>
            <p className="text-[11px] text-outline flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">calendar_month</span>
              Member since {memberSince}
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
          {isSeller && (
            <Link
              to="/sell?tab=listings"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-xs font-semibold text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-base text-primary">garage</span>
              My Listings
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
              Admin Queue
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Are you sure you want to sign out?")) {
                logout();
                navigate("/");
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-error/30 text-error hover:bg-error/10 text-xs font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sign Out
          </button>
        </div>
      </div>

      {/* Account Activity Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <Link
          to="/saved"
          className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 shadow-sm hover:-translate-y-0.5 hover:border-primary/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-on-surface-variant">Saved Cars</span>
            <span className="material-symbols-outlined text-xl text-primary">favorite</span>
          </div>
          <div className="text-2xl font-bold text-on-surface">
            {isLoading ? "—" : stats.favoritesCount}
          </div>
          <span className="text-[11px] text-outline mt-1">Shortlisted garage</span>
        </Link>

        <Link
          to="/inquiries"
          className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 shadow-sm hover:-translate-y-0.5 hover:border-primary/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-on-surface-variant">Conversations</span>
            <span className="material-symbols-outlined text-xl text-primary">forum</span>
          </div>
          <div className="text-2xl font-bold text-on-surface">
            {isLoading ? "—" : stats.inquiriesCount}
          </div>
          <span className="text-[11px] text-outline mt-1">Buyer/seller chats</span>
        </Link>

        <Link
          to={isSeller ? "/sell?tab=listings" : "/sell"}
          className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 shadow-sm hover:-translate-y-0.5 hover:border-primary/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-on-surface-variant">
              {isSeller ? "My Listings" : "Seller Portal"}
            </span>
            <span className="material-symbols-outlined text-xl text-primary">directions_car</span>
          </div>
          <div className="text-2xl font-bold text-on-surface">
            {isLoading ? "—" : isSeller ? stats.listingsCount : "Sell"}
          </div>
          <span className="text-[11px] text-outline mt-1">
            {isSeller ? "Inventory count" : "List your car"}
          </span>
        </Link>

        <Link
          to="/inspections"
          className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 shadow-sm hover:-translate-y-0.5 hover:border-primary/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-on-surface-variant">Inspections</span>
            <span className="material-symbols-outlined text-xl text-primary">verified</span>
          </div>
          <div className="text-2xl font-bold text-on-surface">
            {isLoading ? "—" : stats.inspectionsCount}
          </div>
          <span className="text-[11px] text-outline mt-1">204-pt bookings</span>
        </Link>
      </div>

      {/* Tabs Switcher: Profile Details vs Security & Password */}
      <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "details"
              ? "bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/30"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-base">badge</span>
          Profile Details
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "security"
              ? "bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/30"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-base">lock_reset</span>
          Security & Password
        </button>
      </div>

      {/* TAB 1: PROFILE DETAILS FORM */}
      {activeTab === "details" && (
        <form
          onSubmit={handleSaveProfile}
          className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/35 shadow-sm space-y-6"
        >
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface">
              Personal Information
            </h2>
            <p className="text-xs text-on-surface-variant">
              Manage your contact details so verified buyers and sellers can reach you smoothly.
            </p>
          </div>

          {profileSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/25 text-error text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{profileError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-semibold text-on-surface-variant mb-1.5"
              >
                Full Name *
              </label>
              <input
                id="profile-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shoaib Ahmed"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            {/* Email (Read-Only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="profile-email"
                  className="text-xs font-semibold text-on-surface-variant"
                >
                  Email Address
                </label>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  Verified ID
                </span>
              </div>
              <input
                id="profile-email"
                type="email"
                disabled
                value={user?.email || ""}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container text-on-surface-variant text-sm cursor-not-allowed opacity-80"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="profile-phone"
                className="block text-xs font-semibold text-on-surface-variant mb-1.5"
              >
                Contact Phone Number
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
              <p className="text-[11px] text-outline mt-1">
                Used for SMS alerts on inquiries and inspection bookings.
              </p>
            </div>

            {/* City Location */}
            <div>
              <label
                htmlFor="profile-city"
                className="block text-xs font-semibold text-on-surface-variant mb-1.5"
              >
                Primary City Location
              </label>
              <select
                id="profile-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              >
                {cities
                  .filter((c) => c.value !== "all")
                  .map((c) => (
                    <option key={c.value} value={c.label}>
                      {c.label}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-outline mt-1">
                Auto-selected when you list a car or book an inspection bay.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-outline-variant/30 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary text-xs sm:text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 transition-all"
            >
              {isSavingProfile ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: SECURITY & PASSWORD FORM */}
      {activeTab === "security" && (
        <form
          onSubmit={handleChangePassword}
          className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/35 shadow-sm space-y-6"
        >
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface">
              Change Account Password
            </h2>
            <p className="text-xs text-on-surface-variant">
              Ensure your account uses a secure password of at least 8 characters.
            </p>
          </div>

          {passwordSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/25 text-error text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{passwordError}</span>
            </div>
          )}

          <div className="space-y-4 max-w-md">
            {/* Current Password */}
            <div>
              <label
                htmlFor="current-password"
                className="block text-xs font-semibold text-on-surface-variant mb-1.5"
              >
                Current Password *
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  aria-label="Toggle password visibility"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showCurrentPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-on-surface-variant mb-1.5"
              >
                New Password (min 8 characters) *
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  aria-label="Toggle password visibility"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showNewPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-on-surface-variant mb-1.5"
              >
                Confirm New Password *
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-outline-variant/30 flex items-center justify-end">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary text-xs sm:text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 transition-all"
            >
              {isChangingPassword ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">key</span>
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

