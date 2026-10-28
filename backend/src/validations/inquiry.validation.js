import { z } from "zod";

export const createInquirySchema = z.object({
  message: z
    .string({ required_error: "Message is required" })
    .min(5, "Message must be at least 5 characters long")
    .max(1000, "Message cannot exceed 1000 characters")
    .trim(),
  phone: z.string().trim().optional(),
});
