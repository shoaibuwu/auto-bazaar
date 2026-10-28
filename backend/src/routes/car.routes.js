import { Router } from "express";
import {
  getPublicCars,
  createCar,
  getMyListings,
  getCarById,
  updateCar,
  submitForReview,
  markAsSold,
  deleteCar,
} from "../controllers/car.controller.js";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import { uploadCarImages } from "../middleware/upload.middleware.js";
import validate from "../middleware/validate.js";
import {
  createCarSchema,
  updateCarSchema,
  searchCarsQuerySchema,
} from "../validations/car.validation.js";

const router = Router();

// ==========================================
// PUBLIC ROUTES (No login required for shoppers)
// ==========================================
router.get("/", validate(searchCarsQuerySchema, "query"), getPublicCars);
router.get("/:id", getCarById);

// ==========================================
// PROTECTED ROUTES (Requires login)
// ==========================================
router.use(authenticate);

// Seller listing routes
router.post(
  "/",
  authorizeRoles("seller", "admin"),
  uploadCarImages,
  validate(createCarSchema),
  createCar
);

router.get("/my-listings", getMyListings);

router.patch(
  "/:id",
  uploadCarImages,
  validate(updateCarSchema),
  updateCar
);

// Workflow state transition routes
router.patch("/:id/submit", submitForReview);
router.patch("/:id/sold", markAsSold);

router.delete("/:id", deleteCar);

export default router;
