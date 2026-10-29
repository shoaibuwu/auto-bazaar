import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createCar,
  getMyListings,
  submitCarForReview,
  markCarAsSold,
  deleteCar,
} from "../api/cars.api";
import { cities } from "../data/filters";

export default function SellCarPage({ onOpenAuth }) {
  const { user, isAuthenticated, isSeller, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab: "create" or "listings"
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "listings" ? "listings" : "create"
  );

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "listings") {
      setActiveTab("listings");
    }
  }, [searchParams]);

  // Form State
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(2022);
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [city, setCity] = useState("Lahore");
  const [bodyType, setBodyType] = useState("sedan");
  const [fuelType, setFuelType] = useState("petrol");
  const [transmission, setTransmission] = useState("automatic");
  const [description, setDescription] = useState("");

  // Photos State
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  // UI status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [formError, setFormError] = useState("");

  // Seller's existing listings state
  const [myListings, setMyListings] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Clean up object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // Fetch seller's listings
  const fetchSellerListings = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoadingListings(true);
      const listings = await getMyListings();
      setMyListings(listings);
    } catch (err) {
      console.warn("Could not fetch seller listings:", err.message);
    } finally {
      setIsLoadingListings(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === "listings") {
      fetchSellerListings();
    }
  }, [activeTab, fetchSellerListings]);

  // Handle Photo selection with client-side preview URLs
  const handlePhotoSelect = (e) => {
    const rawFiles = Array.from(e.target.files);
    // Filter only valid image files
    const files = rawFiles.filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;

    if (selectedFiles.length + files.length > 5) {
      setFormError("You can upload a maximum of 5 photos per vehicle.");
      return;
    }

    setFormError("");
    setSelectedFiles((prev) => [...prev, ...files]);

    // Create instant previews
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls((prev) => [...prev, ...newPreviews]);

    // Reset input so user can add more photos if desired
    e.target.value = "";
  };

  // Remove photo from selection
  const handleRemovePhoto = (index) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Form Submission
  const handleSubmit = async (shouldAutoSubmit = true) => {
    setFormError("");
    setSubmitSuccess(null);

    // Basic client validations
    if (!make.trim() || !model.trim()) {
      setFormError("Please provide both make and model.");
      return;
    }
    if (!price || Number(price) < 50000) {
      setFormError("Price must be at least PKR 50,000.");
      return;
    }
    if (mileage === "" || Number(mileage) < 0) {
      setFormError("Please provide valid mileage.");
      return;
    }
    if (selectedFiles.length === 0) {
      setFormError("Please select at least 1 photo of your car.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Construct multipart FormData
      const formData = new FormData();
      const title = `${year} ${make.trim()} ${model.trim()}`.trim();
      formData.append("title", title);
      formData.append("make", make.trim());
      formData.append("model", model.trim());
      formData.append("year", Number(year));
      formData.append("price", Number(price));
      formData.append("mileage", Number(mileage));
      formData.append("city", city);
      formData.append("bodyType", bodyType);
      formData.append("fuelType", fuelType);
      formData.append("transmission", transmission);
      formData.append("description", description.trim());

      // Append binary files
      selectedFiles.forEach((file) => {
        formData.append("images", file);
      });

      // 1. Create car
      const newCar = await createCar(formData);

      // 2. If user clicked "Save & Submit for Review", immediately submit it
      if (shouldAutoSubmit && newCar.id) {
        await submitCarForReview(newCar.id);
        setSubmitSuccess({
          title: "Listing Submitted for Review! 🎉",
          message:
            "Your car has been uploaded and sent to admin moderation. Once approved, it will go live on the homepage.",
        });
      } else {
        setSubmitSuccess({
          title: "Draft Saved! 📝",
          message:
            "Your car listing has been saved as a draft. You can submit it for review whenever you are ready.",
        });
      }

      // Reset form
      setModel("");
      setPrice("");
      setMileage("");
      setDescription("");
      setSelectedFiles([]);
      setPreviewUrls([]);
    } catch (err) {
      if (err.errors && err.errors.length > 0) {
        const errorDetails = err.errors.map((e) => e.message || `${e.field}: invalid`).join(". ");
        setFormError(errorDetails);
      } else {
        setFormError(err.message || "Failed to create vehicle listing");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Submit existing draft for review
  const handleSubmitExisting = async (carId) => {
    try {
      setActionLoadingId(carId);
      await submitCarForReview(carId);
      await fetchSellerListings();
    } catch (err) {
      alert(err.message || "Could not submit for review");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Mark published car as sold
  const handleMarkSold = async (carId) => {
    if (!window.confirm("Are you sure you want to mark this car as sold?")) return;
    try {
      setActionLoadingId(carId);
      await markCarAsSold(carId);
      await fetchSellerListings();
    } catch (err) {
      alert(err.message || "Could not mark as sold");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Delete car
  const handleDeleteCar = async (carId) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) return;
    try {
      setActionLoadingId(carId);
      await deleteCar(carId);
      await fetchSellerListings();
    } catch (err) {
      alert(err.message || "Could not delete listing");
    } finally {
      setActionLoadingId(null);
    }
  };

  // If NOT logged in: Show clean login prompt
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">add_business</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface mb-2">
          Sign In to Sell Your Car
        </h1>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
          Join Pakistan's premier verified automotive marketplace. Connect with certified buyers, get fair valuations, and sell safely.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-95 transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-lg">login</span>
          Sign In / Create Seller Account
        </button>
      </div>
    );
  }

  // If logged in as Buyer (not Seller/Admin)
  if (!isSeller && !isAdmin) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">badge</span>
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-2">
          Seller Account Required
        </h1>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
          Your current account (<strong>{user?.email}</strong>) is registered with the <strong>Buyer</strong> role. To list cars, please create a Seller account or contact support.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-95 transition-all shadow-md"
        >
          Switch to Seller Account
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-8 md:py-12">
      
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-outline-variant/30 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
            Seller Portal
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            List verified vehicles and track approval status across Pakistan.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant/30 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("create");
              setSearchParams({});
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "create"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            List a Vehicle
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("listings");
              setSearchParams({ tab: "listings" });
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "listings"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-base">garage</span>
            My Listings ({myListings.length})
          </button>
        </div>
      </div>

      {/* TAB 1: LIST A VEHICLE FORM */}
      {activeTab === "create" && (
        <div className="space-y-6">
          
          {/* Success Banner */}
          {submitSuccess && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-base">
                <span className="material-symbols-outlined text-xl">check_circle</span>
                {submitSuccess.title}
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {submitSuccess.message}
              </p>
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("listings");
                    setSearchParams({ tab: "listings" });
                  }}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  View My Listings
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(null)}
                  className="text-xs font-semibold underline text-on-surface-variant"
                >
                  List Another Vehicle
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {formError && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-lg shrink-0">error</span>
              <span>{formError}</span>
            </div>
          )}

          {/* Form Container */}
          <div className="p-6 sm:p-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-8">
            
            {/* Section 1: Vehicle Identity */}
            <div>
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                  1
                </span>
                Vehicle Identity
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Make *
                  </label>
                  <select
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    <option value="Toyota">Toyota</option>
                    <option value="Honda">Honda</option>
                    <option value="Suzuki">Suzuki</option>
                    <option value="Kia">Kia</option>
                    <option value="Hyundai">Hyundai</option>
                    <option value="MG">MG</option>
                    <option value="Changan">Changan</option>
                    <option value="Haval">Haval</option>
                    <option value="Nissan">Nissan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Model *
                  </label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Corolla Altis, Civic RS"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Model Year *
                  </label>
                  <input
                    type="number"
                    min="1990"
                    max={new Date().getFullYear() + 1}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Body Type
                  </label>
                  <select
                    value={bodyType}
                    onChange={(e) => setBodyType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary capitalize"
                  >
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="hatchback">Hatchback</option>
                    <option value="crossover">Crossover</option>
                    <option value="coupe">Coupe</option>
                    <option value="van">Van</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Pricing & Location */}
            <div className="pt-6 border-t border-outline-variant/30">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                  2
                </span>
                Pricing & Location
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-on-surface-variant">
                      Demanded Price (PKR) *
                    </label>
                    {price && Number(price) > 0 && (
                      <span className="text-xs font-bold text-primary">
                        PKR {Number(price).toLocaleString("en-PK")}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="50000"
                    step="10000"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 5200000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    City Location *
                  </label>
                  <select
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
                </div>
              </div>
            </div>

            {/* Section 3: Technical Specifications */}
            <div className="pt-6 border-t border-outline-variant/30">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                  3
                </span>
                Technical Specifications
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Mileage (km) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="e.g. 35000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Fuel Type *
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary capitalize"
                  >
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="electric">Electric</option>
                    <option value="cng">CNG</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                    Transmission *
                  </label>
                  <select
                    value={transmission}
                    onChange={(e) => setTransmission(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary capitalize"
                  >
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Photo Uploader with Live Preview */}
            <div className="pt-6 border-t border-outline-variant/30">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                  4
                </span>
                Car Photos (Up to 5) *
              </h2>
              <p className="text-xs text-on-surface-variant mb-4">
                Upload clear photos of front exterior, side profile, and interior dashboard.
              </p>

              {/* Upload Drop Area */}
              <label className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed border-outline-variant/60 hover:border-primary bg-surface-container-low/50 hover:bg-surface-container cursor-pointer transition-all text-center group">
                <span className="material-symbols-outlined text-4xl text-outline group-hover:text-primary transition-colors mb-2">
                  add_photo_alternate
                </span>
                <span className="text-sm font-semibold text-on-surface">
                  Click to select vehicle photos
                </span>
                <span className="text-xs text-on-surface-variant mt-1">
                  Supported formats: JPEG, PNG, WEBP (Max 5MB each)
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>

              {/* Instant Image Previews */}
              {previewUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {previewUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-[4/3] rounded-xl overflow-hidden bg-surface-container border border-outline-variant/30 group shadow-sm"
                    >
                      <img
                        src={url}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-white hover:bg-error transition-colors"
                        title="Remove photo"
                      >
                        <span className="material-symbols-outlined text-sm leading-none">close</span>
                      </button>
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white">
                        Photo {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Description */}
            <div className="pt-6 border-t border-outline-variant/30">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                Seller Description & Additional Features (Optional)
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mention features like: First owner, bumper-to-bumper original paint, complete service history, Android screen installed, brand new tyres..."
                className="w-full p-3.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
              />
            </div>

            {/* Submit Action Buttons */}
            <div className="pt-6 border-t border-outline-variant/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit(false)}
                className="px-5 py-3 rounded-xl border border-outline-variant/60 text-on-surface font-semibold text-sm hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit(true)}
                className="px-6 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Uploading & Submitting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">send</span>
                    <span>Publish & Submit for Review</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: MY LISTINGS VIEW */}
      {activeTab === "listings" && (
        <div className="space-y-6">
          {isLoadingListings ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 animate-pulse flex gap-4"
                >
                  <div className="w-32 aspect-[4/3] bg-surface-container rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2 py-2">
                    <div className="h-5 w-1/3 bg-surface-container rounded" />
                    <div className="h-4 w-1/4 bg-surface-container rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : myListings.length === 0 ? (
            <div className="py-16 px-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 text-center">
              <span className="material-symbols-outlined text-5xl text-outline mb-2">
                garage
              </span>
              <h3 className="text-lg font-bold text-on-surface">No Listings Yet</h3>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto mt-1 mb-4">
                You haven't listed any vehicles yet. List your first car today and get verified buyers nationwide.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-sm hover:opacity-95"
              >
                + List Your First Car
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myListings.map((car) => {
                const isLoadingAction = actionLoadingId === car.id;

                // Status configuration badge
                let statusBadge = (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-500/10 text-gray-500 border border-gray-500/20">
                    Draft
                  </span>
                );

                if (car.status === "pending_review") {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Pending Review
                    </span>
                  );
                } else if (car.status === "published") {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Published / Live
                    </span>
                  );
                } else if (car.status === "sold") {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Sold
                    </span>
                  );
                } else if (car.status === "rejected") {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-error/10 text-error border border-error/20">
                      Rejected
                    </span>
                  );
                }

                return (
                  <div
                    key={car.id}
                    className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                  >
                    {/* Left: Thumbnail & Details */}
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={car.image}
                        alt={car.title}
                        className="w-24 sm:w-32 aspect-[4/3] rounded-xl object-cover bg-surface-container shrink-0 border border-outline-variant/30"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {statusBadge}
                          <span className="text-xs text-on-surface-variant">
                            {car.city}
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-on-surface truncate">
                          {car.title}
                        </h3>
                        <div className="text-sm font-bold text-primary mt-0.5">
                          {car.priceFormatted}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {car.mileage} • {car.fuel} • {car.transmission}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {car.status === "draft" && (
                        <>
                          <button
                            type="button"
                            disabled={isLoadingAction}
                            onClick={() => handleSubmitExisting(car.id)}
                            className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-95 shadow-sm transition-opacity"
                          >
                            Submit for Review
                          </button>
                          <button
                            type="button"
                            disabled={isLoadingAction}
                            onClick={() => handleDeleteCar(car.id)}
                            className="p-2 rounded-xl border border-error/30 text-error hover:bg-error/10 transition-colors"
                            title="Delete draft"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </>
                      )}

                      {car.status === "published" && (
                        <>
                          <Link
                            to={`/cars/${car.id}`}
                            className="px-3.5 py-2 rounded-xl border border-outline-variant/50 text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors"
                          >
                            View Live
                          </Link>
                          <button
                            type="button"
                            disabled={isLoadingAction}
                            onClick={() => handleMarkSold(car.id)}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:opacity-95 shadow-sm transition-opacity"
                          >
                            Mark Sold
                          </button>
                        </>
                      )}

                      {car.status === "pending_review" && (
                        <span className="text-xs text-on-surface-variant italic">
                          Awaiting admin inspection
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
