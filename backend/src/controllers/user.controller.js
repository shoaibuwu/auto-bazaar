import User from "../models/user.model.js";
import Favorite from "../models/favorite.model.js";
import Car from "../models/car.model.js";
import Inquiry from "../models/inquiry.model.js";
import InspectionBooking from "../models/inspectionBooking.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * @desc    Get current user profile with live platform stats
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [favoritesCount, listingsCount, inquiriesCount, inspectionsCount] =
    await Promise.all([
      Favorite.countDocuments({ user: userId }).catch(() => 0),
      Car.countDocuments({ seller: userId }).catch(() => 0),
      Inquiry.countDocuments({
        $or: [{ buyer: userId }, { seller: userId }],
      }).catch(() => 0),
      InspectionBooking.countDocuments({ user: userId }).catch(() => 0),
    ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: req.user,
        stats: {
          favoritesCount,
          listingsCount,
          inquiriesCount,
          inspectionsCount,
        },
      },
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
  const { name, phoneNumber, avatar, city } = req.body;

  // Build an update object containing strictly allowlisted fields
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (city !== undefined) updateData.city = city;

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

/**
 * @desc    Change password for logged-in user
 * @route   PATCH /api/v1/users/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    throw new ApiError(404, "User account not found");
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, "Current password is incorrect");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      400,
      "New password cannot be identical to current password"
    );
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      null,
      "Password updated successfully"
    )
  );
});
