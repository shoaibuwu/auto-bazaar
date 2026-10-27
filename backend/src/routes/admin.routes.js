import { Router } from "express";
import {
  getPendingCars,
  getAllCars,
  approveCar,
  rejectCar,
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

export default router;
