import { Router } from "express";
import {
  createInquiry,
  getMyInquiries,
  getInquiryById,
  sendInquiryMessage,
  markInquiryAsRead,
  deleteInquiry,
} from "../controllers/inquiry.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import validate from "../middleware/validate.js";
import {
  createInquirySchema,
  replyMessageSchema,
} from "../validations/inquiry.validation.js";

const router = Router();

// All inquiry operations require authentication
router.use(authenticate);

router.get("/", getMyInquiries);
router.post("/:carId", validate(createInquirySchema), createInquiry);
router.get("/:id", getInquiryById);
router.post("/:id/messages", validate(replyMessageSchema), sendInquiryMessage);
router.patch("/:id/read", markInquiryAsRead);
router.delete("/:id", deleteInquiry);

export default router;
