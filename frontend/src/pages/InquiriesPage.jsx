import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyInquiries, deleteInquiry } from "../api/inquiries.api";

const BACKEND_BASE = "http://localhost:5000";

export default function InquiriesPage({ onOpenAuth }) {
  const { user, isAuthenticated } = useAuth();

  // State
  const [inquiries, setInquiries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'received' | 'sent'
  const [deletingId, setDeletingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Fetch inquiries from backend
  const fetchInquiries = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      setError("");
      const data = await getMyInquiries();
      setInquiries(data);
    } catch (err) {
      console.error("Failed to load inquiries:", err);
      setError(err.message || "Failed to load inquiries.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Handle Delete Conversation
  const handleDelete = async (inquiryId) => {
    if (!window.confirm("Are you sure you want to remove this inquiry from your inbox?")) {
      return;
    }
    try {
      setDeletingId(inquiryId);
      await deleteInquiry(inquiryId);
      setInquiries((prev) => prev.filter((item) => item._id !== inquiryId));
      setActionNotice({
        type: "success",
        message: "Inquiry conversation deleted successfully.",
      });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      setActionNotice({
        type: "error",
        message: err.message || "Failed to delete inquiry.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Helper to format car image URL
  const getCarImageUrl = (car) => {
    if (!car || !car.images || car.images.length === 0) {
      return "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80";
    }
    const raw = car.images[0];
    return raw.startsWith("http") ? raw : `${BACKEND_BASE}${raw}`;
  };

  // Helper to clean phone for WhatsApp
  const formatWhatsAppUrl = (phone, carTitle) => {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) {
      clean = "92" + clean.slice(1);
    }
    const message = encodeURIComponent(
      `Assalam o Alaikum, I'm reaching out regarding your vehicle listing: ${carTitle || "Car on AutoBazaar"}.`
    );
    return `https://wa.me/${clean}?text=${message}`;
  };

  // Derived filtered inquiries
  const { receivedList, sentList, filteredList } = useMemo(() => {
    const currentUserId = user?._id || user?.id;

    const received = inquiries.filter((inq) => {
      const sellerId = inq.seller?._id || inq.seller;
      return sellerId === currentUserId;
    });

    const sent = inquiries.filter((inq) => {
      const buyerId = inq.buyer?._id || inq.buyer;
      return buyerId === currentUserId;
    });

    let filtered = inquiries;
    if (activeTab === "received") filtered = received;
    else if (activeTab === "sent") filtered = sent;

    return { receivedList: received, sentList: sent, filteredList: filtered };
  }, [inquiries, user, activeTab]);

  // Auth Guard
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">chat_bubble_outline</span>
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-2">
          Sign In to Access Inquiries
        </h1>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
          Track messages from interested buyers and stay in touch with verified sellers across Pakistan.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-95 shadow-md transition-all"
        >
          <span className="material-symbols-outlined text-base">login</span>
          Sign In / Create Account
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8 md:py-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-outline-variant/30 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-28">
              forum
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              Messages & Inquiries
            </h1>
          </div>
          <p className="text-sm text-on-surface-variant">
            Connect with verified buyers and sellers, schedule viewings, and close deals safely.
          </p>
        </div>

        {/* Tab Filter Pills */}
        <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant/30 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "all"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>All Messages</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
              {inquiries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("received")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "received"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>Received</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {receivedList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sent")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "sent"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>Sent</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {sentList.length}
            </span>
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-medium border animate-in fade-in ${
            actionNotice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-error/10 border-error/30 text-error"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {actionNotice.type === "success" ? "check_circle" : "error"}
            </span>
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="hover:opacity-75"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Global Error Notice */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchInquiries}
            className="underline font-semibold ml-4 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Inbox Body */}
      {isLoading ? (
        // Loading Skeleton
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 animate-pulse flex flex-col md:flex-row gap-5"
            >
              <div className="w-24 h-20 bg-surface-container rounded-xl shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-1/3 bg-surface-container rounded" />
                <div className="h-4 w-1/4 bg-surface-container rounded" />
                <div className="h-10 w-full bg-surface-container rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        // Empty Inbox State
        <div className="py-20 px-4 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">mark_email_read</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">
            No Inquiries Found
          </h2>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto mb-6 leading-relaxed">
            {activeTab === "received"
              ? "You haven't received any buyer inquiries for your vehicle listings yet."
              : activeTab === "sent"
              ? "You haven't sent any inquiries to sellers yet. Browse cars and ask sellers questions directly!"
              : "Your inquiries inbox is empty. When you send or receive questions about cars, they will appear right here."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-md hover:opacity-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">directions_car</span>
            Explore Used Cars
          </Link>
        </div>
      ) : (
        // List of Inquiries
        <div className="space-y-4">
          {filteredList.map((inquiry) => {
            const currentUserId = user?._id || user?.id;
            const isSeller = (inquiry.seller?._id || inquiry.seller) === currentUserId;
            const counterpart = isSeller ? inquiry.buyer : inquiry.seller;
            const contactPhone = inquiry.phone || counterpart?.phoneNumber;
            const car = inquiry.car;
            const carTitle = car?.title || "Vehicle Listing";
            const carPrice = car?.price ? `PKR ${car.price.toLocaleString("en-PK")}` : "";
            const carImg = getCarImageUrl(car);
            const whatsAppUrl = formatWhatsAppUrl(contactPhone, carTitle);
            const isDeleting = deletingId === inquiry._id;

            return (
              <div
                key={inquiry._id}
                className="p-5 sm:p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm hover:border-outline-variant/60 transition-all flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
              >
                {/* Left: Car Thumbnail & Snippet */}
                <div className="flex items-start gap-4 flex-1">
                  {car ? (
                    <Link
                      to={`/cars/${car._id}`}
                      className="w-24 sm:w-28 aspect-[4/3] rounded-xl overflow-hidden bg-surface-container border border-outline-variant/30 shrink-0 group relative hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={carImg}
                        alt={carTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80";
                        }}
                      />
                    </Link>
                  ) : (
                    <div className="w-24 sm:w-28 aspect-[4/3] rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant text-xs">
                      Delisted
                    </div>
                  )}

                  {/* Message & Counterpart Details */}
                  <div className="flex-1 min-w-0">
                    {/* Role Tag & Vehicle Title */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isSeller
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                      }`}>
                        {isSeller ? "Buyer Inquiry" : "Your Sent Message"}
                      </span>

                      {car ? (
                        <Link
                          to={`/cars/${car._id}`}
                          className="font-bold text-sm text-on-surface hover:text-primary transition-colors truncate capitalize"
                        >
                          {carTitle}
                        </Link>
                      ) : (
                        <span className="font-bold text-sm text-on-surface-variant line-through">
                          Listing Unavailable
                        </span>
                      )}

                      {carPrice && (
                        <span className="text-xs font-extrabold text-primary font-mono tnum">
                          {carPrice}
                        </span>
                      )}
                    </div>

                    {/* Counterpart info */}
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-2.5">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                        {counterpart?.name ? counterpart.name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <span className="font-semibold text-on-surface">
                        {counterpart?.name || "AutoBazaar User"}
                      </span>
                      {contactPhone && (
                        <span className="font-mono text-[11px] text-on-surface-variant">
                          • {contactPhone}
                        </span>
                      )}
                      <span>•</span>
                      <span className="text-[11px] font-mono text-outline">
                        {new Date(inquiry.createdAt).toLocaleDateString("en-PK", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Message Speech Bubble */}
                    <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface leading-relaxed italic relative">
                      "{inquiry.message}"
                    </div>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="w-full md:w-auto flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-outline-variant/20 shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Call Button */}
                    {contactPhone && (
                      <a
                        href={`tel:${contactPhone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-outline-variant/40 transition-colors"
                        title="Call counterpart"
                      >
                        <span className="material-symbols-outlined text-sm text-emerald-600 dark:text-emerald-400">
                          call
                        </span>
                        <span className="hidden sm:inline">Call</span>
                      </a>
                    )}

                    {/* WhatsApp Button */}
                    {whatsAppUrl && (
                      <a
                        href={whatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <span className="material-symbols-outlined text-sm">
                          chat
                        </span>
                        <span>WhatsApp</span>
                      </a>
                    )}

                    {/* Delete Inquiry Button */}
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(inquiry._id)}
                      className="p-2 rounded-xl border border-error/30 text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                      title="Delete inquiry"
                    >
                      <span className={`material-symbols-outlined text-base ${isDeleting ? "animate-spin" : ""}`}>
                        {isDeleting ? "progress_activity" : "delete"}
                      </span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
