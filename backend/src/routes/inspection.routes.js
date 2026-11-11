import { Router } from "express";
import {
  getInspectionOverview,
  getLatestCarInspection,
  createInspectionBooking,
  getMyInspectionBookings,
  cancelInspectionBooking,
  completeInspectionBooking,
} from "../controllers/inspection.controller.js";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import validate from "../middleware/validate.js";
import {
  createInspectionBookingSchema,
  completeInspectionSchema,
} from "../validations/inspection.validation.js";

const router = Router();

// Public database-driven inspection overview & public per-vehicle report lookup
router.get("/overview", getInspectionOverview);
router.get("/cars/:carId", getLatestCarInspection);

// Protected inspection booking & report routes
router.use(authenticate);

router.get("/my-bookings", getMyInspectionBookings);
router.post("/bookings", validate(createInspectionBookingSchema), createInspectionBooking);
router.patch("/bookings/:id/cancel", cancelInspectionBooking);
router.patch(
  "/bookings/:id/complete",
  authorizeRoles("admin"),
  validate(completeInspectionSchema),
  completeInspectionBooking
);

export default router;

