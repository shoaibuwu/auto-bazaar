import { Router } from "express";
import {
  register,
  login,
  logout,
  getMe,
} from "../controllers/auth.controller.js";
import validate from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
} from "../validations/auth.validation.js";
import {
  authenticate,
  authLimiter,
} from "../middleware/auth.middleware.js";

const router = Router();

// Public routes (protected by rate limiting and input validation)
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/logout", logout);

// Protected routes (requires valid JWT token)
router.get("/me", authenticate, getMe);

export default router;
