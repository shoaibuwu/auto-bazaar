import Car from "../models/car.model.js";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { recordAuditLog, verifyAuditChainIntegrity } from "../utils/auditLogger.js";
import { seedAuditHistoryIfEmpty } from "../utils/seedAuditHistory.js";

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

  // Audit Ledger Event
  await recordAuditLog({
    actor: {
      id: req.user?._id,
      name: req.user?.name || "Platform Administrator",
      email: req.user?.email || "admin@autobazaar.com",
      role: "admin",
    },
    action: "LISTING_APPROVED",
    actionCategory: "admin",
    summary: `Approved listing #${car._id.toString().slice(-5).toUpperCase()}: ${car.title} for PKR ${Number(car.price || 0).toLocaleString("en-PK")}`,
    targetEntity: {
      entityType: "Listing",
      entityId: String(car._id),
      entityTitle: car.title,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Admin-Client",
    metadata: { price: car.price, city: car.city },
  });

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

  const previousStatus = car.status;
  car.status = "rejected";
  car.rejectionReason = reason;
  await car.save();

  // Audit Ledger Event
  await recordAuditLog({
    actor: {
      id: req.user?._id,
      name: req.user?.name || "Platform Administrator",
      email: req.user?.email || "admin@autobazaar.com",
      role: "admin",
    },
    action: "LISTING_DELISTED",
    actionCategory: "admin",
    summary: `Suspended/delisted listing #${car._id.toString().slice(-5).toUpperCase()}: ${car.title}. Reason: ${reason}`,
    targetEntity: {
      entityType: "Listing",
      entityId: String(car._id),
      entityTitle: car.title,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Admin-Client",
    metadata: { reason, previousStatus },
  });

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

  const deletedTitle = car.title;
  const deletedId = String(car._id);
  const deletedPrice = car.price;

  await car.deleteOne();

  // Audit Ledger Event
  await recordAuditLog({
    actor: {
      id: req.user?._id,
      name: req.user?.name || "Platform Administrator",
      email: req.user?.email || "admin@autobazaar.com",
      role: "admin",
    },
    action: "LISTING_DELETED",
    actionCategory: "security",
    summary: `Permanently deleted listing #${deletedId.slice(-5).toUpperCase()}: ${deletedTitle}`,
    targetEntity: {
      entityType: "Listing",
      entityId: deletedId,
      entityTitle: deletedTitle,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Admin-Client",
    metadata: { deletedCarId: deletedId, price: deletedPrice },
  });

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

  const previousRole = user.role;
  user.role = role;
  await user.save();

  // Audit Ledger Event
  await recordAuditLog({
    actor: {
      id: req.user?._id,
      name: req.user?.name || "Platform Administrator",
      email: req.user?.email || "admin@autobazaar.com",
      role: "admin",
    },
    action: "USER_ROLE_CHANGED",
    actionCategory: "admin",
    summary: `Changed role for user ${user.name} from ${previousRole.toUpperCase()} to ${role.toUpperCase()}`,
    targetEntity: {
      entityType: "User",
      entityId: String(user._id),
      entityTitle: `${user.name} (${user.email})`,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Admin-Client",
    metadata: { previousRole, newRole: role },
  });

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

  const previousStatus = user.status;
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

  // Audit Ledger Event
  await recordAuditLog({
    actor: {
      id: req.user?._id,
      name: req.user?.name || "Platform Administrator",
      email: req.user?.email || "admin@autobazaar.com",
      role: "admin",
    },
    action: status === "suspended" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_REACTIVATED",
    actionCategory: status === "suspended" ? "security" : "admin",
    summary:
      status === "suspended"
        ? `Suspended user ${user.name} (${user.email}). Reason: ${reason || "Policy violation"}`
        : `Reactivated user account for ${user.name} (${user.email})`,
    targetEntity: {
      entityType: "User",
      entityId: String(user._id),
      entityTitle: `${user.name} (${user.email})`,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Admin-Client",
    metadata: { reason, previousStatus, newStatus: status, delistVehicles },
  });

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

  const deletedName = user.name;
  const deletedEmail = user.email;
  const deletedId = String(user._id);

  // Delete all car listings created by this user
  await Car.deleteMany({ seller: user._id });
  await user.deleteOne();

  // Audit Ledger Event
  await recordAuditLog({
    actor: {
      id: req.user?._id,
      name: req.user?.name || "Platform Administrator",
      email: req.user?.email || "admin@autobazaar.com",
      role: "admin",
    },
    action: "USER_DELETED",
    actionCategory: "security",
    summary: `Permanently deleted user account ${deletedName} (${deletedEmail}) and all associated car listings`,
    targetEntity: {
      entityType: "User",
      entityId: deletedId,
      entityTitle: `${deletedName} (${deletedEmail})`,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Admin-Client",
    metadata: { deletedUserId: deletedId, email: deletedEmail },
  });

  return res.status(200).json(
    new ApiResponse(200, null, "User and all associated listings permanently deleted")
  );
});

/**
 * @desc    Get paginated cryptographic audit log ledger
 * @route   GET /api/v1/admin/audit-logs
 * @access  Private (Admin only)
 */
export const getAuditLogs = asyncHandler(async (req, res) => {
  // Ensure database has initial real entity history if collection is empty
  await seedAuditHistoryIfEmpty();

  const { search, action, actionCategory, actor, page = 1, limit = 20 } = req.query;

  const query = {};
  if (action && action !== "all") {
    query.action = action;
  }
  if (actionCategory && actionCategory !== "all") {
    query.actionCategory = actionCategory;
  }
  if (actor && actor !== "all") {
    query["actor.name"] = new RegExp(actor, "i");
  }
  if (search && search.trim()) {
    const s = search.trim();
    const regex = new RegExp(s, "i");
    query.$or = [
      { "actor.name": regex },
      { "actor.email": regex },
      { summary: regex },
      { action: regex },
      { "targetEntity.entityTitle": regex },
      { "targetEntity.entityId": regex },
      { ipAddress: regex },
      { hash: regex },
    ];
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (pageNum - 1) * limitNum;

  const [logs, totalCount, allStats] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: -1, _id: -1 }).skip(skip).limit(limitNum).lean(),
    AuditLog.countDocuments(query),
    AuditLog.find({}, "action actionCategory hash").sort({ timestamp: -1, _id: -1 }).lean(),
  ]);

  const totalEvents = allStats.length;
  const adminActions = allStats.filter((l) => l.actionCategory === "admin").length;
  const listingEvents = allStats.filter(
    (l) => l.actionCategory === "listing" || l.action.startsWith("LISTING_")
  ).length;
  const securityFlags = allStats.filter(
    (l) =>
      l.actionCategory === "security" ||
      l.action.includes("SUSPENDED") ||
      l.action.includes("DELETED")
  ).length;

  const latestHash = allStats.length > 0 ? allStats[0].hash : "0x00000000";

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        logs,
        pagination: {
          total: totalCount,
          page: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          limit: limitNum,
        },
        metrics: {
          totalEvents,
          adminActions,
          listingEvents,
          securityFlags,
          merkleRoot: latestHash,
        },
      },
      "Audit logs retrieved successfully"
    )
  );
});

/**
 * @desc    Verify cryptographic hash chain integrity
 * @route   POST /api/v1/admin/audit-logs/verify
 * @access  Private (Admin only)
 */
export const verifyAuditChain = asyncHandler(async (req, res) => {
  const result = await verifyAuditChainIntegrity();
  return res.status(200).json(
    new ApiResponse(200, result, "Cryptographic audit chain integrity verified")
  );
});
