import { Router } from "express";
import {
  getPendingCars,
  getAllCars,
  approveCar,
  rejectCar,
  deleteCarByAdmin,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  deleteUserByAdmin,
  getAuditLogs,
  verifyAuditChain,
  getSystemSettings,
  updateSystemSettings,
  clearSystemCache,
} from "../controllers/admin.controller.js";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import validate from "../middleware/validate.js";
import { rejectCarSchema } from "../validations/admin.validation.js";

const router = Router();

// Strict security: all admin routes require both authentication AND admin role
router.use(authenticate, authorizeRoles("admin"));

// Car moderation routes
router.get("/cars/pending", getPendingCars);
router.get("/cars", getAllCars);
router.patch("/cars/:id/approve", approveCar);
router.patch("/cars/:id/reject", validate(rejectCarSchema), rejectCar);
router.delete("/cars/:id", deleteCarByAdmin);

// User and dealer management routes
router.get("/users", getAllUsers);
router.patch("/users/:id/role", updateUserRole);
router.patch("/users/:id/status", updateUserStatus);
router.delete("/users/:id", deleteUserByAdmin);

// Cryptographic Audit Ledger routes
router.get("/audit-logs", getAuditLogs);
router.post("/audit-logs/verify", verifyAuditChain);

// Platform System Settings & Governance routes
router.get("/settings", getSystemSettings);
router.patch("/settings", updateSystemSettings);
router.post("/settings/cache-clear", clearSystemCache);

export default router;
