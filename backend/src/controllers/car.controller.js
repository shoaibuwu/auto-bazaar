import Car from "../models/car.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * @desc    Create a new car listing (Initial status: draft)
 * @route   POST /api/v1/cars
 * @access  Private (Seller/Admin)
 */
export const createCar = asyncHandler(async (req, res) => {
  // Extract uploaded image relative paths from req.files
  const images = req.files && req.files.length > 0
    ? req.files.map((file) => `/uploads/cars/${file.filename}`)
    : [];

  const car = await Car.create({
    ...req.body,
    images,
    seller: req.user._id,
    status: "draft", // Always starts as draft
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { car }, "Car listing created as draft successfully"));
});

/**
 * @desc    Get all listings belonging to current seller
 * @route   GET /api/v1/cars/my-listings
 * @access  Private
 */
export const getMyListings = asyncHandler(async (req, res) => {
  const cars = await Car.find({ seller: req.user._id }).sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(
      200,
      { count: cars.length, cars },
      "Seller listings retrieved successfully"
    )
  );
});

/**
 * @desc    Get car details by ID
 * @route   GET /api/v1/cars/:id
 * @access  Public / Private
 */
export const getCarById = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id).populate(
    "seller",
    "name email phoneNumber avatar"
  );

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { car }, "Car details retrieved successfully"));
});

/**
 * @desc    Update own car listing (Enforces ownership check)
 * @route   PATCH /api/v1/cars/:id
 * @access  Private
 */
export const updateCar = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  // 1. Strict Ownership Check: User can only edit their own listing
  if (car.seller.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Forbidden: You can only edit your own car listings");
  }

  // 2. State Check: Cannot edit sold car
  if (car.status === "sold") {
    throw new ApiError(400, "Sold cars cannot be modified");
  }

  // If new images were uploaded, append them
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((file) => `/uploads/cars/${file.filename}`);
    car.images.push(...newImages);
  }

  // Update provided fields
  Object.assign(car, req.body);

  // If car was previously rejected, updating it moves it back to draft
  if (car.status === "rejected") {
    car.status = "draft";
    car.rejectionReason = "";
  }

  const updatedCar = await car.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { car: updatedCar }, "Car listing updated successfully"));
});

/**
 * @desc    Submit listing for admin review (Status transition: draft -> pending_review)
 * @route   PATCH /api/v1/cars/:id/submit
 * @access  Private
 */
export const submitForReview = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  // Ownership Check
  if (car.seller.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Forbidden: You can only submit your own car listings");
  }

  // State Transition Check
  if (car.status !== "draft" && car.status !== "rejected") {
    throw new ApiError(
      400,
      `Cannot submit listing in '${car.status}' status. Only 'draft' or 'rejected' listings can be submitted.`
    );
  }

  // Quality requirement: At least 1 photo before submitting
  if (!car.images || car.images.length === 0) {
    throw new ApiError(
      400,
      "Please upload at least one image before submitting your listing for review"
    );
  }

  car.status = "pending_review";
  car.rejectionReason = "";
  await car.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { car },
      "Listing submitted for admin review successfully"
    )
  );
});

/**
 * @desc    Mark own car as sold (Status transition: published -> sold)
 * @route   PATCH /api/v1/cars/:id/sold
 * @access  Private
 */
export const markAsSold = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  // Ownership Check
  if (car.seller.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Forbidden: You can only mark your own cars as sold");
  }

  // State Transition Check: Only published cars can be sold
  if (car.status !== "published") {
    throw new ApiError(
      400,
      `Cannot mark car as sold. Only 'published' cars can be marked as sold (Current status: ${car.status})`
    );
  }

  car.status = "sold";
  await car.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { car }, "Car successfully marked as sold"));
});

/**
 * @desc    Delete own car listing
 * @route   DELETE /api/v1/cars/:id
 * @access  Private
 */
export const deleteCar = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  // Ownership Check
  if (car.seller.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Forbidden: You can only delete your own car listings");
  }

  await car.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Car listing deleted successfully"));
});
