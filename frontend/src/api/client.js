import axios from "axios";

/**
 * Centralized API Client for AutoBazaar
 * Configured to connect to the Express backend with HttpOnly cookies enabled.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true, // Crucial: enables sending and receiving HttpOnly JWT cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor: simplifies responses and standardizes error messages
api.interceptors.response.use(
  (response) => {
    // Our backend wraps success in { statusCode, success, message, data }
    return response.data;
  },
  (error) => {
    // Extract backend ApiError message
    const message =
      error.response?.data?.message ||
      error.message ||
      "An unexpected network error occurred";

    const customError = new Error(message);
    customError.statusCode = error.response?.status;
    customError.errors = error.response?.data?.errors || [];
    return Promise.reject(customError);
  }
);

export default api;
