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

/**
 * Permanently delete a car listing entity from MongoDB (Admin only)
 * Calls: DELETE /api/v1/admin/cars/:id
 */
export async function deleteCarByAdmin(carId) {
  const response = await client.delete(`/admin/cars/${carId}`);
  return response?.data || response;
}

/**
 * Fetch all users across the platform with inventory stats and role metrics
 * Calls: GET /api/v1/admin/users
 */
export async function getAllPlatformUsers({
  role = "",
  status = "",
  search = "",
  page = 1,
  limit = 20,
} = {}) {
  const params = {};
  if (role) params.role = role;
  if (status) params.status = status;
  if (search) params.search = search;
  if (page) params.page = page;
  if (limit) params.limit = limit;

  const response = await client.get("/admin/users", { params });
  return (
    response?.data ||
    response || {
      users: [],
      pagination: { total: 0, page: 1, totalPages: 1 },
      metrics: { totalUsers: 0, sellersCount: 0, buyersCount: 0, adminsCount: 0, suspendedCount: 0 },
    }
  );
}

/**
 * Update a user's role (buyer | seller | admin)
 * Calls: PATCH /api/v1/admin/users/:id/role
 */
export async function updateUserRole(userId, role) {
  const response = await client.patch(`/admin/users/${userId}/role`, { role });
  return response?.data?.user || response?.user;
}

/**
 * Suspend or reactivate a user account
 * Calls: PATCH /api/v1/admin/users/:id/status
 */
export async function updateUserStatus(userId, { status, reason = "", delistVehicles = false } = {}) {
  const response = await client.patch(`/admin/users/${userId}/status`, {
    status,
    reason,
    delistVehicles,
  });
  return response?.data?.user || response?.user;
}

/**
 * Permanently delete a user account and their listings (Superadmin)
 * Calls: DELETE /api/v1/admin/users/:id
 */
export async function deleteUserAccountByAdmin(userId) {
  const response = await client.delete(`/admin/users/${userId}`);
  return response?.data || response;
}

/**
 * Fetch paginated cryptographic audit logs & metrics
 * Calls: GET /api/v1/admin/audit-logs
 */
export async function getAuditLogs({
  search = "",
  action = "",
  actionCategory = "",
  actor = "",
  page = 1,
  limit = 20,
} = {}) {
  const params = {};
  if (search) params.search = search;
  if (action) params.action = action;
  if (actionCategory) params.actionCategory = actionCategory;
  if (actor) params.actor = actor;
  if (page) params.page = page;
  if (limit) params.limit = limit;

  const response = await client.get("/admin/audit-logs", { params });
  return (
    response?.data ||
    response || {
      logs: [],
      pagination: { total: 0, page: 1, totalPages: 1 },
      metrics: { totalEvents: 0, adminActions: 0, listingEvents: 0, securityFlags: 0, merkleRoot: "0x0" },
    }
  );
}

/**
 * Verify cryptographic hash chain integrity
 * Calls: POST /api/v1/admin/audit-logs/verify
 */
export async function verifyAuditChain() {
  const response = await client.post("/admin/audit-logs/verify");
  return response?.data || response;
}

/**
 * Fetch platform system settings & governance policy
 * Calls: GET /api/v1/admin/settings
 */
export async function getSystemSettings() {
  const response = await client.get("/admin/settings");
  return response?.data?.settings || response?.settings || null;
}

/**
 * Update platform system settings
 * Calls: PATCH /api/v1/admin/settings
 */
export async function updateSystemSettings(settingsPayload) {
  const response = await client.patch("/admin/settings", settingsPayload);
  return response?.data?.settings || response?.settings || null;
}

/**
 * Clear system cache & verify database connection
 * Calls: POST /api/v1/admin/settings/cache-clear
 */
export async function clearSystemCache() {
  const response = await client.post("/admin/settings/cache-clear");
  return response?.data || response;
}
