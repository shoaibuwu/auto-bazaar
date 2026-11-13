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
  return response?.data || response || {};
}

/**
 * Fetch current user's unread notification count
 */
export async function getUnreadNotificationCount() {
  const response = await api.get("/notifications/unread-count");
  const data = response?.data || response || {};
  return data.unreadCount ?? 0;
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

