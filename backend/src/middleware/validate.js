import ApiError from "../utils/ApiError.js";

/**
 * Middleware factory that validates request body, query, or params against a Zod schema.
 * @param {import("zod").ZodSchema} schema - Zod schema to validate against
 * @param {"body" | "query" | "params"} source - Property of req to validate (default: "body")
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      // Format Zod errors into a clean, human-readable array
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(new ApiError(400, "Validation failed", formattedErrors));
    }

    // Replace req[source] with sanitized, parsed data (safe for Express 5 getters)
    if (source === "query" || source === "params") {
      Object.defineProperty(req, source, {
        value: result.data,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      req[source] = result.data;
    }
    next();
  };
};

export default validate;
