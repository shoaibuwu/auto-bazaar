import api from "./client";

/**
 * Fetch notifications for current user with filtering and pagination
 * @param {object} options
 * @param {string} options.filter - 'all' | 'unread' | 'price' | 'inspection' | 'chat'
 * @param {number} options.page - page number (default 1)
 * @param {number} options.limit - items per page (default 40)
 */
export async function getNotifications({ filter = "all", page = 1, limit = 40 } = {}) {
  const response = await api.get("/notifications", {
    params: { filter, page, limit },
  });

  // response is the backend payload unwrapped by client.js interceptor:
  // e.g. { success: true, counts: {...}, pagination: {...}, data: [...] }
  const items = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : [];

  const counts = response?.counts || {
    all: items.length,
    unread: items.filter((n) => !n.isRead).length,
    price: items.filter((n) => n.type === "PRICE_DROP").length,
    inspection: items.filter((n) => n.type === "INSPECTION_UPDATE").length,
    chat: items.filter((n) => n.type === "INQUIRY_MESSAGE" || n.type === "OFFER_RECEIVED").length,
  };

  const pagination = response?.pagination || {
    page,
    limit,
    total: items.length,
    totalPages: 1,
  };

  return {
    success: response?.success ?? true,
    data: items,
    notifications: items,
    counts,
    pagination,
  };
}

/**
 * Fetch current user's unread notification count
 */
export async function getUnreadNotificationCount() {
  const response = await api.get("/notifications/unread-count");
  const count = response?.unreadCount ?? response?.data?.unreadCount ?? 0;
  return typeof count === "number" ? count : 0;
}

/**
 * Mark a single notification as read
 * @param {string} id
 */
export async function markNotificationAsRead(id) {
  const response = await api.patch(`/notifications/${id}/read`);
  return response?.data || response || {};
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  const response = await api.patch("/notifications/mark-all-read");
  return response?.data || response || {};
}

/**
 * Clear all read notifications
 */
export async function clearReadNotifications() {
  const response = await api.delete("/notifications/clear-read");
  return response?.data || response || {};
}

/**
 * Delete a single notification
 * @param {string} id
 */
export async function deleteNotification(id) {
  const response = await api.delete(`/notifications/${id}`);
  return response?.data || response || {};
}

