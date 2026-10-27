import { z } from "zod";

/**
 * Validation schema for updating user profile.
 * Uses .strict() to reject any unexpected fields (e.g. role, password, status).
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters")
      .trim()
      .optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
        "Please provide a valid phone number"
      )
      .optional()
      .or(z.literal("")),
    avatar: z
      .string()
      .url("Avatar must be a valid URL")
      .optional()
      .or(z.literal("")),
  })
  .strict({
    message: "You cannot update unauthorized fields (such as role, email, or status)",
  });
