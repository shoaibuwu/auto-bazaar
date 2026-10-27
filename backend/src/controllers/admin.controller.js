import Car from "../models/car.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * @desc    Get all cars pending admin review
 * @route   GET /api/v1/admin/cars/pending
 * @access  Private (Admin only)
 */
export const getPendingCars = asyncHandler(async (req, res) => {
  const pendingCars = await Car.find({ status: "pending_review" })
    .populate("seller", "name email phoneNumber avatar")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        count: pendingCars.length,
        cars: pendingCars,
      },
      "Pending cars retrieved successfully"
    )
  );
});

/**
 * @desc    Get all cars across platform (with optional status filter & pagination)
 * @route   GET /api/v1/admin/cars
 * @access  Private (Admin only)
 */
export const getAllCars = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) {
    query.status = status;
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 50); // Cap at 50
  const skip = (pageNum - 1) * limitNum;

  const [cars, total] = await Promise.all([
    Car.find(query)
      .populate("seller", "name email phoneNumber avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Car.countDocuments(query),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        cars,
      },
      "All platform cars retrieved successfully"
    )
  );
});

/**
 * @desc    Approve car listing (Status transition: pending_review -> published)
 * @route   PATCH /api/v1/admin/cars/:id/approve
 * @access  Private (Admin only)
 */
export const approveCar = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  if (car.status !== "pending_review") {
    throw new ApiError(
      400,
      `Cannot approve listing in '${car.status}' status. Only cars in 'pending_review' can be approved.`
    );
  }

  car.status = "published";
  car.rejectionReason = "";
  await car.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { car },
      "Car listing approved and published successfully"
    )
  );
});

/**
 * @desc    Reject car listing with reason (Status transition: pending_review -> rejected)
 * @route   PATCH /api/v1/admin/cars/:id/reject
 * @access  Private (Admin only)
 */
export const rejectCar = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  if (car.status !== "pending_review") {
    throw new ApiError(
      400,
      `Cannot reject listing in '${car.status}' status. Only cars in 'pending_review' can be rejected.`
    );
  }

  car.status = "rejected";
  car.rejectionReason = reason;
  await car.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { car },
      "Car listing rejected with reason provided"
    )
  );
});
