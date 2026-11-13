import Notification from "../models/notification.model.js";
import {
  seedStarterNotificationsIfEmpty,
} from "../utils/notification.util.js";
import { getIO } from "../socket/socket.js";

/**
 * Get all notifications for the authenticated user with filtering and tab counts
 * GET /api/v1/notifications
 */
export async function getMyNotifications(req, res) {
  try {
    const userId = req.user._id;

    // Auto-seed starter notifications if user's inbox is empty
    await seedStarterNotificationsIfEmpty(userId, req.user.city || "Karachi");

    const { filter = "all", limit = 40, page = 1 } = req.query;

    const baseQuery = { recipient: userId };
    const query = { ...baseQuery };

    if (filter === "unread") {
      query.isRead = false;
    } else if (filter === "price" || filter === "price_drop") {
      query.type = "PRICE_DROP";
    } else if (filter === "inspection") {
      query.type = "INSPECTION_UPDATE";
    } else if (filter === "chat" || filter === "bookings_chat") {
      query.type = { $in: ["INQUIRY_MESSAGE", "OFFER_RECEIVED"] };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 40));
    const skip = (pageNum - 1) * limitNum;

    // Fetch notifications and live counts concurrently
    const [notifications, totalMatching, totalAll, totalUnread, totalPrice, totalInspection, totalChat] =
      await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate("actor", "name avatar")
          .populate("relatedCar", "title make model year price images city status")
          .lean(),
        Notification.countDocuments(query),
        Notification.countDocuments(baseQuery),
        Notification.countDocuments({ ...baseQuery, isRead: false }),
        Notification.countDocuments({ ...baseQuery, type: "PRICE_DROP" }),
        Notification.countDocuments({ ...baseQuery, type: "INSPECTION_UPDATE" }),
        Notification.countDocuments({
          ...baseQuery,
          type: { $in: ["INQUIRY_MESSAGE", "OFFER_RECEIVED"] },
        }),
      ]);

    return res.status(200).json({
      success: true,
      counts: {
        all: totalAll,
        unread: totalUnread,
        price: totalPrice,
        inspection: totalInspection,
        chat: totalChat,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalMatching,
        totalPages: Math.ceil(totalMatching / limitNum) || 1,
      },
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load notifications",
      error: error.message,
    });
  }
}

/**
 * Get just the unread count (lightweight polling / fast header sync)
 * GET /api/v1/notifications/unread-count
 */
export async function getUnreadCount(req, res) {
  try {
    const userId = req.user._id;
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Error getting unread notification count:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to count unread notifications",
    });
  }
}

/**
 * Mark a single notification as read
 * PATCH /api/v1/notifications/:id/read
 */
export async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    const io = getIO();
    if (io) {
      io.to(`user:${userId.toString()}`).emit("notification:unread_count", unreadCount);
    }

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notif,
    });
  } catch (error) {
    console.error("Error marking notification read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
}

/**
 * Mark all notifications as read for current user
 * PATCH /api/v1/notifications/mark-all-read
 */
export async function markAllAsRead(req, res) {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    const io = getIO();
    if (io) {
      io.to(`user:${userId.toString()}`).emit("notification:unread_count", 0);
    }

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      unreadCount: 0,
    });
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
}

/**
 * Clear (delete) all read notifications
 * DELETE /api/v1/notifications/clear-read
 */
export async function clearReadNotifications(req, res) {
  try {
    const userId = req.user._id;

    const result = await Notification.deleteMany({
      recipient: userId,
      isRead: true,
    });

    return res.status(200).json({
      success: true,
      message: `Cleared ${result.deletedCount} read notifications`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing read notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear read notifications",
    });
  }
}

/**
 * Delete a single notification
 * DELETE /api/v1/notifications/:id
 */
export async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notif = await Notification.findOneAndDelete({
      _id: id,
      recipient: userId,
    });

    if (!notif) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    const io = getIO();
    if (io) {
      io.to(`user:${userId.toString()}`).emit("notification:unread_count", unreadCount);
    }

    return res.status(200).json({
      success: true,
      message: "Notification removed",
      unreadCount,
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
}

