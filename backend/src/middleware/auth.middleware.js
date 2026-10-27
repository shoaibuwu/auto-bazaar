import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/user.model.js";

/**
 * Authentication Middleware
 * Checks for JWT in HttpOnly cookie or Authorization Bearer header.
 * Verifies token and attaches user document to req.user.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check HttpOnly cookie first (recommended for browser security)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Bearer token header (useful for Postman, mobile clients)
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new ApiError(401, "Not authenticated. Please log in to gain access.");
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists in DB
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      throw new ApiError(
        401,
        "The user belonging to this token no longer exists."
      );
    }

    // Attach user to the request object
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid authentication token. Please log in again.");
    }
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Your authentication token has expired. Please log in again.");
    }
    throw error;
  }
});

/**
 * Authorization Middleware (Role-Based Access Control)
 * Restricts access to specific user roles (e.g., 'seller', 'admin')
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access forbidden: Role '${req.user?.role || "anonymous"}' is not authorized to access this resource`
        )
      );
    }
    next();
  };
};

/**
 * Rate limiter for Auth routes to prevent brute-force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    statusCode: 429,
    message: "Too many attempts from this IP. Please try again after 15 minutes.",
  },
});
