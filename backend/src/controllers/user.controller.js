import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req, res) => {
  // req.user is set by the authenticate middleware
  return res.status(200).json(
    new ApiResponse(
      200,
      { user: req.user },
      "Profile retrieved successfully"
    )
  );
});

/**
 * @desc    Update current user profile (Allowlisted fields only)
 * @route   PATCH /api/v1/users/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phoneNumber, avatar } = req.body;

  // Build an update object containing strictly allowlisted fields
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
  if (avatar !== undefined) updateData.avatar = avatar;

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, "Please provide at least one field to update");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    {
      new: true, // Return the updated document instead of the original
      runValidators: true, // Run Mongoose schema validators on the update
    }
  );

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { user: updatedUser },
      "Profile updated successfully"
    )
  );
});
