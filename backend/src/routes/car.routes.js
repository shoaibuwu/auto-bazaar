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
// PUBLIC & PROTECTED ROUTES ORDERING
// ==========================================
// Note: Static routes like /my-listings must be registered before /:id
router.get("/", validate(searchCarsQuerySchema, "query"), getPublicCars);
router.get("/my-listings", authenticate, getMyListings);
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
