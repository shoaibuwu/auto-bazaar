import Car from "../models/car.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * @desc    Get all published cars (Public search, filters, sorting, and pagination)
 * @route   GET /api/v1/cars
 * @access  Public
 */
export const getPublicCars = asyncHandler(async (req, res) => {
  const {
    search,
    make,
    model,
    fuelType,
    transmission,
    condition,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    maxMileage,
    sort = "newest",
    page = 1,
    limit = 10,
  } = req.query;

  // 1. Privacy Rule: Strictly return ONLY published cars
  const filter = {
    status: "published",
  };

  // 2. Full-text search (matches title, make, model, or description)
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { make: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // 3. Exact/Pattern field filters
  if (make) {
    filter.make = { $regex: `^${make}$`, $options: "i" };
  }
  if (model) {
    filter.model = { $regex: `^${model}$`, $options: "i" };
  }
  if (fuelType) {
    filter.fuelType = fuelType;
  }
  if (transmission) {
    filter.transmission = transmission;
  }
  if (condition) {
    filter.condition = condition;
  }

  // 4. Numeric range filters
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  }

  if (minYear !== undefined || maxYear !== undefined) {
    filter.year = {};
    if (minYear !== undefined) filter.year.$gte = Number(minYear);
    if (maxYear !== undefined) filter.year.$lte = Number(maxYear);
  }

  if (maxMileage !== undefined) {
    filter.mileage = { $lte: Number(maxMileage) };
  }

  // 5. Sorting strategy
  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    mileage_asc: { mileage: 1 },
    year_desc: { year: -1 },
  };
  const sortOption = sortMap[sort] || sortMap.newest;

  // 6. Safe Pagination with Hard Cap (max 50 per page to protect DB)
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);
  const skip = (pageNum - 1) * limitNum;

  // Execute query and total count concurrently
  const [cars, total] = await Promise.all([
    Car.find(filter)
      .populate("seller", "name phoneNumber avatar")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum),
    Car.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        cars,
      },
      "Published cars retrieved successfully"
    )
  );
});

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
