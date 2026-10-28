import Favorite from "../models/favorite.model.js";
import Car from "../models/car.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * @desc    Toggle favorite on a car listing (Add if not favorited, Remove if already favorited)
 * @route   POST /api/v1/favorites/:carId
 * @access  Private (Requires login)
 */
export const toggleFavorite = asyncHandler(async (req, res) => {
  const { carId } = req.params;

  // Check if car exists
  const car = await Car.findById(carId);
  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  // Check if already favorited
  const existingFavorite = await Favorite.findOne({
    user: req.user._id,
    car: carId,
  });

  if (existingFavorite) {
    // Un-favorite
    await existingFavorite.deleteOne();
    return res.status(200).json(
      new ApiResponse(
        200,
        { isFavorited: false },
        "Car removed from your favorites"
      )
    );
  }

  // Add to favorites
  await Favorite.create({
    user: req.user._id,
    car: carId,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { isFavorited: true },
      "Car added to your favorites"
    )
  );
});

/**
 * @desc    Get all favorited cars for current user
 * @route   GET /api/v1/favorites
 * @access  Private (Requires login)
 */
export const getMyFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ user: req.user._id })
    .populate({
      path: "car",
      populate: {
        path: "seller",
        select: "name phoneNumber avatar",
      },
    })
    .sort({ createdAt: -1 });

  // Clean up any favorites pointing to deleted cars
  const validFavorites = favorites.filter((fav) => fav.car !== null);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        count: validFavorites.length,
        favorites: validFavorites,
      },
      "Favorite cars retrieved successfully"
    )
  );
});

/**
 * @desc    Check if a specific car is favorited by current user
 * @route   GET /api/v1/favorites/:carId/check
 * @access  Private
 */
export const checkIsFavorited = asyncHandler(async (req, res) => {
  const { carId } = req.params;

  const favorite = await Favorite.findOne({
    user: req.user._id,
    car: carId,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { isFavorited: Boolean(favorite) },
      "Favorite status checked"
    )
  );
});
