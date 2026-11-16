import api from "./client";

/**
 * Fetch aggregated Buyer Dashboard data
 */
export async function getBuyerDashboard() {
  const res = await api.get("/buyer-dashboard");
  // Client interceptor unwraps response.data:
  // res is { statusCode: 200, data: { buyerProfile, stats, counts, records, inquiries, appointments, savedCars, recommendedCars }, message, success: true }
  // or { buyerProfile, stats, ... }
  const data = res?.data || res || {};
  return data;
}

