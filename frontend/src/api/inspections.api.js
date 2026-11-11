import api from "./client";
import { formatCar } from "./cars.api";

/**
 * Fetch inspection system standards, regional hubs, live DB stats, and featured cars
 */
export const getInspectionOverview = async () => {
  const response = await api.get("/inspections/overview");
  if (response.success && response.data) {
    return {
      ...response.data,
      featuredCars: (response.data.featuredCars || []).map(formatCar).filter(Boolean),
    };
  }
  throw new Error(response.message || "Failed to load inspection data from database");
};

/**
 * Fetch latest completed public inspection report for a specific vehicle listing
 */
export const getLatestCarInspection = async (carId) => {
  const response = await api.get(`/inspections/cars/${carId}`);
  if (response.success) {
    return response.data?.report || null;
  }
  return null;
};

/**
 * Schedule an inspection booking in MongoDB
 */
export const createInspectionBooking = async (payload) => {
  const response = await api.post("/inspections/bookings", payload);
  if (response.success && response.data?.booking) {
    return response.data.booking;
  }
  throw new Error(response.message || "Failed to book inspection");
};

/**
 * Fetch inspection bookings & reports for authenticated user (or all if admin passes scope=all)
 */
export const getMyInspectionBookings = async ({ scope } = {}) => {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  const response = await api.get(`/inspections/my-bookings${query}`);
  if (response.success && response.data?.bookings) {
    return response.data.bookings;
  }
  return [];
};

/**
 * Cancel a scheduled inspection booking
 */
export const cancelInspectionBooking = async (bookingId) => {
  const response = await api.patch(`/inspections/bookings/${bookingId}/cancel`);
  if (response.success && response.data?.booking) {
    return response.data.booking;
  }
  throw new Error(response.message || "Failed to cancel inspection booking");
};

/**
 * Record official diagnostic score & complete inspection report (Admin only)
 */
export const completeInspectionBooking = async (bookingId, payload) => {
  const response = await api.patch(`/inspections/bookings/${bookingId}/complete`, payload);
  if (response.success && response.data?.booking) {
    return response.data.booking;
  }
  throw new Error(response.message || "Failed to complete inspection report");
};

