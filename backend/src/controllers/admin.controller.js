import Car from "../models/car.model.js";
import User from "../models/user.model.js";
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
 * @desc    Approve or reactivate car listing (Status transition: pending_review | rejected -> published)
 * @route   PATCH /api/v1/admin/cars/:id/approve
 * @access  Private (Admin only)
 */
export const approveCar = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  // Admins can approve newly submitted cars OR reactivate previously suspended/rejected cars
  if (car.status !== "pending_review" && car.status !== "rejected") {
    throw new ApiError(
      400,
      `Cannot approve listing in '${car.status}' status. Only cars in 'pending_review' or 'rejected' can be approved.`
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
 * @desc    Reject or delist car listing with reason (Status transition: pending_review | published -> rejected)
 * @route   PATCH /api/v1/admin/cars/:id/reject
 * @access  Private (Admin only)
 */
export const rejectCar = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  // Admins can reject submissions OR delist/suspend active published listings
  if (car.status !== "pending_review" && car.status !== "published") {
    throw new ApiError(
      400,
      `Cannot reject or delist listing in '${car.status}' status. Only cars in 'pending_review' or 'published' can be sanctioned.`
    );
  }

  car.status = "rejected";
  car.rejectionReason = reason;
  await car.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { car },
      "Car listing delisted/rejected with reason provided"
    )
  );
});

/**
 * @desc    Permanently delete car listing entity (Superuser action)
 * @route   DELETE /api/v1/admin/cars/:id
 * @access  Private (Admin only)
 */
export const deleteCarByAdmin = asyncHandler(async (req, res) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  await car.deleteOne();

  return res.status(200).json(
    new ApiResponse(200, null, "Car listing entity permanently deleted by admin")
  );
});

/**
 * @desc    Get all users across platform with inventory metrics
 * @route   GET /api/v1/admin/users
 * @access  Private (Admin only)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { role, status, search, page = 1, limit = 20 } = req.query;

  // By default, exclude platform administrators from marketplace user registry
  const query = { role: { $ne: "admin" } };

  if (role && role !== "all" && role !== "admin") {
    query.role = role;
  }
  if (status && status !== "all") {
    query.status = status;
  }
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$and = [
      { role: { $ne: "admin" } },
      {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
        ],
      },
    ];
    delete query.role; // handled inside $and
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 50);
  const skip = (pageNum - 1) * limitNum;

  const [rawUsers, totalCount, allUsersForStats] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    User.countDocuments(query),
    User.find({ role: { $ne: "admin" } }, "role status").lean(),
  ]);

  // Global counts for KPI cards (marketplace customers only)
  const totalUsers = allUsersForStats.length;
  const sellersCount = allUsersForStats.filter((u) => u.role === "seller").length;
  const buyersCount = allUsersForStats.filter((u) => u.role === "buyer").length;
  const suspendedCount = allUsersForStats.filter((u) => u.status === "suspended").length;

  // Enrich returned users with their car listing volume
  const userIds = rawUsers.map((u) => u._id);
  const cars = await Car.find({ seller: { $in: userIds } }, "seller price status").lean();

  const users = rawUsers.map((user) => {
    const userCars = cars.filter((c) => String(c.seller) === String(user._id));
    const activeListings = userCars.filter((c) => c.status === "published").length;
    const pendingListings = userCars.filter((c) => c.status === "pending_review").length;
    const suspendedListings = userCars.filter((c) => c.status === "rejected").length;
    const totalVolumePkr = userCars
      .filter((c) => c.status === "published")
      .reduce((sum, c) => sum + (Number(c.price) || 0), 0);

    return {
      ...user,
      id: user._id,
      activeListings,
      pendingListings,
      suspendedListings,
      totalListings: userCars.length,
      totalVolumePkr,
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          total: totalCount,
          page: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          limit: limitNum,
        },
        metrics: {
          totalUsers,
          sellersCount,
          buyersCount,
          suspendedCount,
        },
      },
      "Users retrieved successfully"
    )
  );
});

/**
 * @desc    Update a user's role (buyer <-> seller <-> admin)
 * @route   PATCH /api/v1/admin/users/:id/role
 * @access  Private (Admin only)
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["buyer", "seller", "admin"].includes(role)) {
    throw new ApiError(400, "Invalid role. Allowed values: buyer, seller, admin");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.role = role;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, { user }, `User role updated to ${role} successfully`)
  );
});

/**
 * @desc    Suspend or reactivate a user account with optional inventory delist
 * @route   PATCH /api/v1/admin/users/:id/status
 * @access  Private (Admin only)
 */
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason = "", delistVehicles = false } = req.body;

  if (!["active", "suspended"].includes(status)) {
    throw new ApiError(400, "Invalid status. Allowed values: active, suspended");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "admin") {
    throw new ApiError(403, "Cannot suspend an administrator account");
  }

  user.status = status;
  user.suspensionReason = reason;
  await user.save();

  // If suspending and requested, shadow-hold/delist active vehicle listings
  if (status === "suspended" && delistVehicles) {
    await Car.updateMany(
      { seller: user._id, status: "published" },
      {
        $set: {
          status: "rejected",
          rejectionReason: `Account suspended by Admin: ${reason || "Administrative sanction"}`,
        },
      }
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { user },
      `User account ${status === "suspended" ? "suspended" : "reactivated"} successfully`
    )
  );
});

/**
 * @desc    Permanently delete a user account and their listings (Superadmin)
 * @route   DELETE /api/v1/admin/users/:id
 * @access  Private (Admin only)
 */
export const deleteUserByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "admin") {
    throw new ApiError(403, "Cannot delete an administrator account");
  }

  // Delete all car listings created by this user
  await Car.deleteMany({ seller: user._id });
  await user.deleteOne();

  return res.status(200).json(
    new ApiResponse(200, null, "User and all associated listings permanently deleted")
  );
});
