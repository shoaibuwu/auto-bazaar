import { Router } from "express";
import { getBuyerDashboard } from "../controllers/buyerDashboard.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Buyer dashboard requires authentication
router.use(authenticate);

router.get("/", getBuyerDashboard);

export default router;

