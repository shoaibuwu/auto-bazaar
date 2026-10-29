import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user already has an active session on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await api.get("/auth/me");
        if (response.success && response.data?.user) {
          setUser(response.data.user);
        }
      } catch (err) {
        // Not logged in or token expired - perfectly normal for visitors
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Login handler
  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    if (response.success && response.data?.user) {
      setUser(response.data.user);
      return response.data.user;
    }
    throw new Error(response.message || "Login failed");
  };

  // Register handler
  const register = async ({ name, email, password, role = "buyer", phoneNumber = "" }) => {
    const response = await api.post("/auth/register", {
      name,
      email,
      password,
      role,
      phoneNumber,
    });
    if (response.success && response.data?.user) {
      setUser(response.data.user);
      return response.data.user;
    }
    throw new Error(response.message || "Registration failed");
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout error:", err.message);
    } finally {
      setUser(null);
    }
  };

  // Refresh user data (e.g. after updating profile)
  const refreshUser = async () => {
    try {
      const response = await api.get("/auth/me");
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      }
    } catch {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    role: user?.role || null,
    isSeller: user?.role === "seller",
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use AuthContext in any component
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
