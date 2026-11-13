import { Router } from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import validate from "../middleware/validate.js";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "../validations/user.validation.js";

const router = Router();

// Protect all user routes below - must be logged in
router.use(authenticate);

// Profile endpoints
router.get("/profile", getProfile);
router.patch("/profile", validate(updateProfileSchema), updateProfile);
router.patch("/change-password", validate(changePasswordSchema), changePassword);

export default router;
