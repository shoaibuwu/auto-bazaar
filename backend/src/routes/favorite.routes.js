import { Router } from "express";
import {
  toggleFavorite,
  getMyFavorites,
  checkIsFavorited,
} from "../controllers/favorite.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// All favorites operations require login
router.use(authenticate);

router.post("/:carId", toggleFavorite);
router.get("/", getMyFavorites);
router.get("/:carId/check", checkIsFavorited);

export default router;
