import api from "./api";

/**
 * Fetch latest 20 notifications and unread_count for the logged-in user.
 */
export async function getNotifications() {
  const response = await api.get("/api/notifications");
  return response.data;
}

/**
 * Mark a single notification as read.
 * @param {string} id - Notification ID
 */
export async function markNotificationRead(id) {
  const response = await api.put(`/api/notifications/${id}/read`);
  return response.data;
}

/**
 * Mark all notifications as read for the logged-in user.
 */
export async function markAllNotificationsRead() {
  const response = await api.put("/api/notifications/read-all");
  return response.data;
}
