import { Router } from "express";
import {
  getProfile,
  updateProfile,
} from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import validate from "../middleware/validate.js";
import { updateProfileSchema } from "../validations/user.validation.js";

const router = Router();

// Protect all user routes below - must be logged in
router.use(authenticate);

// Profile endpoints
router.get("/profile", getProfile);
router.patch("/profile", validate(updateProfileSchema), updateProfile);

export default router;
