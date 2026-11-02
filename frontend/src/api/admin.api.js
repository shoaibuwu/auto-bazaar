import client from "./client";

/**
 * Fetch all vehicles currently waiting for admin moderation
 * Calls: GET /api/v1/admin/cars/pending
 */
export async function getPendingCars() {
  const response = await client.get("/admin/cars/pending");
  return response?.data?.cars || response?.cars || [];
}

/**
 * Fetch all vehicles across the entire platform with optional status filter & pagination
 * Calls: GET /api/v1/admin/cars?status=...&page=...
 */
export async function getAllPlatformCars({ status = "", page = 1, limit = 20 } = {}) {
  const params = {};
  if (status) params.status = status;
  if (page) params.page = page;
  if (limit) params.limit = limit;

  const response = await client.get("/admin/cars", { params });
  return response?.data || response || { cars: [], total: 0, page: 1, totalPages: 1 };
}

/**
 * Approve a pending vehicle listing
 * Moves status: pending_review -> published
 * Calls: PATCH /api/v1/admin/cars/:id/approve
 */
export async function approveCar(carId) {
  const response = await client.patch(`/admin/cars/${carId}/approve`);
  return response?.data?.car || response?.car;
}

/**
 * Reject a vehicle listing with a required explanation note
 * Moves status: pending_review -> rejected
 * Calls: PATCH /api/v1/admin/cars/:id/reject
 * Payload: { reason: string }
 */
export async function rejectCar(carId, reason) {
  const response = await client.patch(`/admin/cars/${carId}/reject`, { reason });
  return response?.data?.car || response?.car;
}
