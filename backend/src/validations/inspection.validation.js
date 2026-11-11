import { z } from "zod";
import { INSPECTION_TIME_SLOTS } from "../models/inspectionBooking.model.js";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createInspectionBookingSchema = z
  .object({
    hubId: z
      .string({ required_error: "Inspection hub is required" })
      .trim()
      .regex(objectIdRegex, "Invalid inspection hub ID"),
    carId: z
      .preprocess(
        (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
        z.string().trim().regex(objectIdRegex, "Invalid vehicle listing ID").optional()
      )
      .optional(),
    bookingType: z
      .enum(["buyer_pre_purchase", "seller_certification"])
      .optional()
      .default("buyer_pre_purchase"),
    vehicleLabel: z
      .string()
      .trim()
      .max(140, "Vehicle description cannot exceed 140 characters")
      .optional(),
    registrationCity: z
      .string()
      .trim()
      .max(60, "City cannot exceed 60 characters")
      .optional(),
    contactPhone: z
      .string({ required_error: "Contact phone number is required" })
      .trim()
      .min(7, "Please enter a valid contact phone number")
      .max(30, "Phone number cannot exceed 30 characters"),
    preferredDate: z
      .string({ required_error: "Preferred inspection date is required" })
      .trim()
      .refine((val) => !Number.isNaN(Date.parse(val)), {
        message: "Please choose a valid inspection date",
      })
      .refine(
        (val) => {
          const picked = new Date(val);
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          // Allow booking for today regardless of client TZ offset up to 14 hours
          return picked.getTime() >= todayStart.getTime() - 14 * 60 * 60 * 1000;
        },
        { message: "Preferred inspection date cannot be in the past" }
      ),
    timeSlot: z.enum(INSPECTION_TIME_SLOTS, {
      errorMap: () => ({ message: "Please select a valid inspection time slot" }),
    }),
    notes: z
      .string()
      .trim()
      .max(600, "Notes cannot exceed 600 characters")
      .optional()
      .default(""),
  })
  .superRefine((data, ctx) => {
    if (!data.carId) {
      if (!data.vehicleLabel || data.vehicleLabel.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vehicleLabel"],
          message: "Please specify vehicle year, make, and model (e.g. 2021 Honda Civic)",
        });
      }
      if (!data.registrationCity || data.registrationCity.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["registrationCity"],
          message: "Please specify the vehicle city",
        });
      }
    }
  });

const optionalDomainScore = z
  .preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0, "Score must be >= 0").max(10, "Score must be <= 10").optional()
  )
  .optional();

export const completeInspectionSchema = z.object({
  score: z.coerce
    .number({ required_error: "Overall inspection score is required" })
    .min(0, "Score must be between 0.0 and 10.0")
    .max(10, "Score must be between 0.0 and 10.0"),
  domainScores: z
    .object({
      engine: optionalDomainScore,
      chassis: optionalDomainScore,
      suspension: optionalDomainScore,
      interior: optionalDomainScore,
      road: optionalDomainScore,
      documents: optionalDomainScore,
    })
    .optional(),
  inspectorNotes: z
    .string()
    .trim()
    .max(1000, "Inspector notes cannot exceed 1000 characters")
    .optional()
    .default(""),
});

