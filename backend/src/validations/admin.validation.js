import { z } from "zod";

export const rejectCarSchema = z.object({
  reason: z
    .string({ required_error: "Rejection reason is required" })
    .min(5, "Rejection reason must be at least 5 characters long")
    .max(500, "Rejection reason cannot exceed 500 characters")
    .trim(),
});
