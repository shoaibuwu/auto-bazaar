import { z } from "zod";

const currentYear = new Date().getFullYear();

const baseCarSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title cannot exceed 100 characters")
    .trim(),
  make: z
    .string({ required_error: "Make is required" })
    .min(1, "Make cannot be empty")
    .trim(),
  model: z
    .string({ required_error: "Model is required" })
    .min(1, "Model cannot be empty")
    .trim(),
  year: z.coerce
    .number({ required_error: "Year is required" })
    .int("Year must be an integer")
    .min(1900, "Year must be 1900 or newer")
    .max(currentYear + 1, "Year cannot be in the future"),
  price: z.coerce
    .number({ required_error: "Price is required" })
    .min(0, "Price must be 0 or greater"),
  mileage: z.coerce
    .number({ required_error: "Mileage is required" })
    .min(0, "Mileage cannot be negative"),
  fuelType: z.preprocess(
    (val) => (typeof val === "string" ? val.toLowerCase().trim() : val),
    z.enum(["petrol", "diesel", "electric", "hybrid"], {
      errorMap: () => ({
        message: "Fuel type must be petrol, diesel, electric, or hybrid",
      }),
    })
  ),
  transmission: z.preprocess(
    (val) => (typeof val === "string" ? val.toLowerCase().trim() : val),
    z.enum(["automatic", "manual"], {
      errorMap: () => ({
        message: "Transmission must be either automatic or manual",
      }),
    })
  ),
  condition: z
    .preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase().trim() : val),
      z.enum(["new", "used"]).default("used")
    )
    .optional(),
  description: z.string().trim().optional().default(""),
});

// Normalize keys (e.g. support both 'fuelType' and 'fueltype')
const normalizeCarInput = (data) => {
  if (data && typeof data === "object") {
    const normalized = { ...data };
    if (!normalized.fuelType && normalized.fueltype) {
      normalized.fuelType = normalized.fueltype;
    }
    return normalized;
  }
  return data;
};

export const createCarSchema = z.preprocess(normalizeCarInput, baseCarSchema);
export const updateCarSchema = z.preprocess(normalizeCarInput, baseCarSchema.partial());

export const searchCarsQuerySchema = z.object({
  search: z.string().trim().optional(),
  make: z.string().trim().optional(),
  model: z.string().trim().optional(),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid"]).optional(),
  transmission: z.enum(["automatic", "manual"]).optional(),
  condition: z.enum(["new", "used"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minYear: z.coerce.number().int().min(1900).optional(),
  maxYear: z.coerce.number().int().optional(),
  maxMileage: z.coerce.number().min(0).optional(),
  sort: z
    .enum(["newest", "oldest", "price_asc", "price_desc", "mileage_asc", "year_desc"])
    .default("newest")
    .optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

