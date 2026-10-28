import { Router } from "express";
import {
  createInquiry,
  getMyInquiries,
  getInquiryById,
  deleteInquiry,
} from "../controllers/inquiry.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import validate from "../middleware/validate.js";
import { createInquirySchema } from "../validations/inquiry.validation.js";

const router = Router();

// All inquiry operations require authentication
router.use(authenticate);

router.post("/:carId", validate(createInquirySchema), createInquiry);
router.get("/", getMyInquiries);
router.get("/:id", getInquiryById);
router.delete("/:id", deleteInquiry);

export default router;
