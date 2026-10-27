import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Cookie options helper
 */
const getCookieOptions = () => ({
  httpOnly: true, // Prevents client-side JS (XSS) from reading the cookie
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/**
 * Helper to generate JWT, set HttpOnly cookie, and send formatted response
 */
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = user.generateAuthToken();

  // Set HttpOnly cookie
  res.cookie("token", token, getCookieOptions());

  // Exclude password from returned user object
  const userSafe = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    phoneNumber: user.phoneNumber,
    createdAt: user.createdAt,
  };

  return res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      {
        user: userSafe,
        token, // Also send token in body for non-browser/Postman usage
      },
      message
    )
  );
};

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phoneNumber } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, "A user with this email address already exists");
  }

  // Create new user (password is automatically hashed by pre-save hook)
  const user = await User.create({
    name,
    email,
    password,
    role: role || "buyer",
    phoneNumber: phoneNumber || "",
  });

  return sendTokenResponse(user, 201, res, "User registered successfully");
});

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Explicitly select '+password' because it is marked select: false in model
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  return sendTokenResponse(user, 200, res, "Logged in successfully");
});

/**
 * @desc    Log out user & clear cookie
 * @route   POST /api/v1/auth/logout
 * @access  Public
 */
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token", {
    ...getCookieOptions(),
    maxAge: 0,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Logged out successfully"));
});

/**
 * @desc    Get currently logged in user profile
 * @route   GET /api/v1/auth/me
 * @access  Private (Requires authentication)
 */
export const getMe = asyncHandler(async (req, res) => {
  // req.user was attached by the authenticate middleware
  return res.status(200).json(
    new ApiResponse(
      200,
      { user: req.user },
      "User profile retrieved successfully"
    )
  );
});
