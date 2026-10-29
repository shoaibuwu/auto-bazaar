import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("buyer");
  const [phoneNumber, setPhoneNumber] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      if (isLoginTab) {
        await login(email, password);
      } else {
        await register({ name, email, password, role, phoneNumber });
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 mb-2">
            <span className="font-title text-title font-bold text-on-surface">AutoBazaar</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary">
              Pakistan
            </span>
          </div>
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
            {isLoginTab ? "Welcome back" : "Create an account"}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            {isLoginTab
              ? "Sign in to contact sellers and save your favorite cars"
              : "Join Pakistan's verified automobile marketplace"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 mb-5 rounded-xl bg-surface-container">
          <button
            type="button"
            onClick={() => {
              setIsLoginTab(true);
              setErrorMessage("");
            }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              isLoginTab
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoginTab(false);
              setErrorMessage("");
            }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              !isLoginTab
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-2 text-error text-sm">
            <span className="material-symbols-outlined text-lg leading-none shrink-0 mt-0.5">
              error
            </span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginTab && (
            <>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shoaib Ahmed"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("buyer")}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                      role === "buyer"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant/60 text-on-surface-variant bg-surface-container-low"
                    }`}
                  >
                    🚗 Buyer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("seller")}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                      role === "seller"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant/60 text-on-surface-variant bg-surface-container-low"
                    }`}
                  >
                    💼 Seller / Dealer
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isLoginTab ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
