import { z } from "zod";

export const createInquirySchema = z.object({
  message: z
    .string({ required_error: "Message is required" })
    .trim()
    .min(1, "Message cannot be empty")
    .max(1500, "Message cannot exceed 1500 characters"),
  phone: z.string().trim().optional(),
  messageType: z.enum(["text", "offer", "viewing"]).optional().default("text"),
  offerPrice: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
      z.number().positive("Offer price must be greater than 0").optional()
    )
    .optional(),
});

export const replyMessageSchema = z.object({
  text: z
    .string({ required_error: "Message text is required" })
    .trim()
    .min(1, "Message cannot be empty")
    .max(1500, "Message cannot exceed 1500 characters"),
  messageType: z.enum(["text", "offer", "viewing"]).optional().default("text"),
  offerPrice: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
      z.number().positive("Offer price must be greater than 0").optional()
    )
    .optional(),
});
