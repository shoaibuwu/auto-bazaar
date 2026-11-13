import { Router } from "express";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearReadNotifications,
  deleteNotification,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Protect all notification routes
router.use(authenticate);

// List & counts
router.get("/", getMyNotifications);
router.get("/unread-count", getUnreadCount);

// Bulk actions
router.patch("/mark-all-read", markAllAsRead);
router.delete("/clear-read", clearReadNotifications);

// Single notification actions
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

export default router;

