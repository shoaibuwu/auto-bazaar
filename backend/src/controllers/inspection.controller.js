import mongoose from "mongoose";
import Car from "../models/car.model.js";
import InspectionStandard from "../models/inspectionStandard.model.js";
import InspectionHub from "../models/inspectionHub.model.js";
import InspectionBooking from "../models/inspectionBooking.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { recordAuditLog } from "../utils/auditLogger.js";
import { seedInspectionSystemIfEmpty } from "../utils/seedInspectionData.js";
import { notifyOnInspectionUpdate } from "../utils/notification.util.js";

/**
 * Derive certification grade & Car status from numeric score and MongoDB standard
 */
function deriveGradeAndStatus(score, standard) {
  const certifiedThreshold = standard?.certifiedThresholdScore ?? 9.0;
  const minimumApproved = standard?.minimumApprovedScore ?? 7.5;

  if (score >= certifiedThreshold) {
    return { grade: "Certified", carInspectionStatus: "certified" };
  }
  if (score >= minimumApproved) {
    return { grade: "Verified", carInspectionStatus: "verified" };
  }
  return { grade: "Flagged", carInspectionStatus: "flagged" };
}

/**
 * @desc    Get full inspections overview from MongoDB (standards, hubs, live stats, published inventory)
 * @route   GET /api/v1/inspections/overview
 * @access  Public
 */
export const getInspectionOverview = asyncHandler(async (req, res) => {
  await seedInspectionSystemIfEmpty();

  const [
    standard,
    hubs,
    publishedCars,
    cityCountsRaw,
    hubBookingCountsRaw,
    totalScheduledBookings,
    totalCompletedReports,
    certifiedCarsCount,
    avgCarScoreAgg,
  ] = await Promise.all([
    InspectionStandard.findOne({ key: "autobazaar_inspection_standard" }).lean(),
    InspectionHub.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    Car.find({ status: "published" })
      .populate("seller", "name phoneNumber avatar")
      .sort({ inspectionScore: -1, createdAt: -1 })
      .lean(),
    Car.aggregate([
      { $match: { status: "published" } },
      {
        $group: {
          _id: { $ifNull: ["$city", "Lahore"] },
          count: { $sum: 1 },
        },
      },
    ]),
    InspectionBooking.aggregate([
      { $match: { status: { $in: ["scheduled", "in_progress"] } } },
      { $group: { _id: "$hub", count: { $sum: 1 } } },
    ]),
    InspectionBooking.countDocuments({ status: { $in: ["scheduled", "in_progress"] } }),
    InspectionBooking.countDocuments({ status: "completed" }),
    Car.countDocuments({
      status: "published",
      inspectionStatus: { $in: ["certified", "verified"] },
    }),
    Car.aggregate([
      { $match: { status: "published", inspectionScore: { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: "$inspectionScore" } } },
    ]),
  ]);

  // Normalize per-city vehicle counts case-insensitively
  const cityCountMap = {};
  for (const row of cityCountsRaw) {
    const key = String(row._id || "lahore").toLowerCase().trim();
    cityCountMap[key] = (cityCountMap[key] || 0) + row.count;
  }

  const hubBookingMap = {};
  for (const row of hubBookingCountsRaw) {
    if (row._id) {
      hubBookingMap[String(row._id)] = row.count;
    }
  }

  const enrichedHubs = hubs.map((hub) => {
    const tags =
      hub.cityTags && hub.cityTags.length > 0
        ? hub.cityTags
        : [hub.city.toLowerCase().trim()];

    const liveListingsCount = tags.reduce(
      (sum, tag) => sum + (cityCountMap[String(tag).toLowerCase().trim()] || 0),
      0
    );

    return {
      ...hub,
      liveListingsCount,
      scheduledBookingsCount: hubBookingMap[String(hub._id)] || 0,
    };
  });

  const totalCheckpoints = (standard?.domains || []).reduce(
    (sum, domain) => sum + Number(domain.points || 0),
    0
  );

  const avgInspectedScore =
    avgCarScoreAgg.length > 0 && typeof avgCarScoreAgg[0].avgScore === "number"
      ? Math.round(avgCarScoreAgg[0].avgScore * 10) / 10
      : null;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        standard,
        totalCheckpoints,
        hubs: enrichedHubs,
        stats: {
          totalCheckpoints,
          domainsCount: (standard?.domains || []).length,
          hubsCount: enrichedHubs.length,
          publishedCarsCount: publishedCars.length,
          certifiedCarsCount,
          completedReportsCount: totalCompletedReports,
          scheduledBookingsCount: totalScheduledBookings,
          avgInspectedScore,
        },
        featuredCars: publishedCars.slice(0, 6),
      },
      "Inspection system overview retrieved from database successfully"
    )
  );
});

/**
 * @desc    Get latest public completed inspection report for a specific vehicle
 * @route   GET /api/v1/inspections/cars/:carId
 * @access  Public
 */
export const getLatestCarInspection = asyncHandler(async (req, res) => {
  const { carId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(carId)) {
    throw new ApiError(400, "Invalid vehicle ID");
  }

  const report = await InspectionBooking.findOne({
    car: carId,
    status: "completed",
  })
    .populate("hub", "city name address baysLabel")
    .populate("inspectedBy", "name")
    .sort({ completedAt: -1, updatedAt: -1 })
    .lean();

  if (!report) {
    return res.status(200).json(
      new ApiResponse(
        200,
        { report: null },
        "No completed inspection report recorded for this vehicle yet"
      )
    );
  }

  // Expose sanitized public report details (do not expose private booker phone)
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        report: {
          _id: report._id,
          car: report.car,
          vehicleLabel: report.vehicleLabel,
          registrationCity: report.registrationCity,
          score: report.score,
          grade: report.grade,
          domainScores: report.domainScores,
          inspectorNotes: report.inspectorNotes,
          completedAt: report.completedAt,
          hub: report.hub,
          inspectorName: report.inspectedBy?.name || "Certified Inspector",
        },
      },
      "Latest inspection report retrieved successfully"
    )
  );
});

/**
 * @desc    Book a new vehicle inspection slot in MongoDB
 * @route   POST /api/v1/inspections/bookings
 * @access  Private (Buyer/Seller/Admin)
 */
export const createInspectionBooking = asyncHandler(async (req, res) => {
  await seedInspectionSystemIfEmpty();

  const {
    hubId,
    carId,
    bookingType = "buyer_pre_purchase",
    vehicleLabel,
    registrationCity,
    contactPhone,
    preferredDate,
    timeSlot,
    notes = "",
  } = req.body;

  const hub = await InspectionHub.findOne({ _id: hubId, isActive: true });
  if (!hub) {
    throw new ApiError(404, "Selected inspection hub was not found or is inactive");
  }

  let linkedCar = null;
  let finalVehicleLabel = vehicleLabel?.trim() || "";
  let finalCity = registrationCity?.trim() || "";

  if (carId) {
    linkedCar = await Car.findById(carId);
    if (!linkedCar) {
      throw new ApiError(404, "Selected vehicle listing was not found");
    }
    if (linkedCar.status === "sold" || linkedCar.status === "rejected") {
      throw new ApiError(
        400,
        `Cannot schedule inspection for a listing in '${linkedCar.status}' status`
      );
    }

    const existingBooking = await InspectionBooking.findOne({
      user: req.user._id,
      car: linkedCar._id,
      status: { $in: ["scheduled", "in_progress"] },
    });

    if (existingBooking) {
      throw new ApiError(
        409,
        "You already have an active scheduled inspection booking for this vehicle."
      );
    }

    if (!finalVehicleLabel) {
      finalVehicleLabel = `${linkedCar.year} ${linkedCar.make} ${linkedCar.model}`.trim();
    }
    if (!finalCity) {
      finalCity = linkedCar.city || hub.city;
    }
  }

  const booking = await InspectionBooking.create({
    user: req.user._id,
    car: linkedCar ? linkedCar._id : null,
    hub: hub._id,
    bookingType,
    vehicleLabel: finalVehicleLabel,
    registrationCity: finalCity,
    contactPhone,
    preferredDate: new Date(preferredDate),
    timeSlot,
    notes,
    status: "scheduled",
    grade: "Pending",
  });

  if (linkedCar && linkedCar.inspectionStatus === "not_inspected") {
    linkedCar.inspectionStatus = "scheduled";
    linkedCar.latestInspectionBooking = booking._id;
    await linkedCar.save();
  }

  // Send real-time notification to booking user
  notifyOnInspectionUpdate({ booking, status: "confirmed" }).catch((err) =>
    console.error("Async inspection confirmed notification failed:", err)
  );

  const populatedBooking = await InspectionBooking.findById(booking._id)
    .populate("hub", "city name address baysLabel phone")
    .populate("car", "title make model year price city images inspectionScore inspectionStatus seller")
    .populate("user", "name email phoneNumber role")
    .lean();

  await recordAuditLog({
    actor: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
    action: "INSPECTION_BOOKED",
    actionCategory: "listing",
    summary: `Inspection scheduled at ${hub.city} hub for ${finalVehicleLabel} on ${new Date(
      preferredDate
    ).toLocaleDateString("en-PK")} (${timeSlot})`,
    targetEntity: {
      entityType: "Inspection",
      entityId: String(booking._id),
      entityTitle: finalVehicleLabel,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Client",
    metadata: {
      hubCity: hub.city,
      carId: linkedCar ? String(linkedCar._id) : null,
      bookingType,
      timeSlot,
    },
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      { booking: populatedBooking },
      "Inspection booking confirmed and saved to database"
    )
  );
});

/**
 * @desc    Get inspection bookings & reports for the authenticated user (or all for admin when ?scope=all)
 * @route   GET /api/v1/inspections/my-bookings
 * @access  Private
 */
export const getMyInspectionBookings = asyncHandler(async (req, res) => {
  const { scope } = req.query;

  let query;
  if (req.user.role === "admin" && scope === "all") {
    query = {};
  } else {
    const ownedCarIds = await Car.find({ seller: req.user._id }).distinct("_id");
    query =
      ownedCarIds.length > 0
        ? { $or: [{ user: req.user._id }, { car: { $in: ownedCarIds } }] }
        : { user: req.user._id };
  }

  const bookings = await InspectionBooking.find(query)
    .populate("hub", "city name address baysLabel phone")
    .populate("car", "title make model year price city images inspectionScore inspectionStatus seller")
    .populate("user", "name email phoneNumber role")
    .populate("inspectedBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        count: bookings.length,
        bookings,
      },
      "Inspection bookings retrieved successfully"
    )
  );
});

/**
 * @desc    Cancel a scheduled inspection booking
 * @route   PATCH /api/v1/inspections/bookings/:id/cancel
 * @access  Private (Booking owner or Admin)
 */
export const cancelInspectionBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid booking ID");
  }

  const booking = await InspectionBooking.findById(id);
  if (!booking) {
    throw new ApiError(404, "Inspection booking not found");
  }

  const isOwner = String(booking.user) === String(req.user._id);
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Forbidden: You can only cancel your own inspection bookings");
  }

  if (booking.status === "completed") {
    throw new ApiError(400, "Completed inspection reports cannot be cancelled");
  }
  if (booking.status === "cancelled") {
    throw new ApiError(400, "This inspection booking is already cancelled");
  }

  booking.status = "cancelled";
  await booking.save();

  // If linked car had status 'scheduled' solely from this booking, restore to 'not_inspected'
  if (booking.car) {
    const car = await Car.findById(booking.car);
    if (car && car.inspectionStatus === "scheduled") {
      const otherActiveCount = await InspectionBooking.countDocuments({
        car: car._id,
        _id: { $ne: booking._id },
        status: { $in: ["scheduled", "in_progress"] },
      });

      if (otherActiveCount === 0) {
        car.inspectionStatus = "not_inspected";
        if (String(car.latestInspectionBooking || "") === String(booking._id)) {
          car.latestInspectionBooking = null;
        }
        await car.save();
      }
    }
  }

  await recordAuditLog({
    actor: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
    action: "INSPECTION_CANCELLED",
    actionCategory: "listing",
    summary: `Cancelled inspection booking #${String(booking._id).slice(-5).toUpperCase()} for ${booking.vehicleLabel}`,
    targetEntity: {
      entityType: "Inspection",
      entityId: String(booking._id),
      entityTitle: booking.vehicleLabel,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Client",
    metadata: { carId: booking.car ? String(booking.car) : null },
  });

  const populated = await InspectionBooking.findById(booking._id)
    .populate("hub", "city name address baysLabel phone")
    .populate("car", "title make model year price city images inspectionScore inspectionStatus seller")
    .populate("user", "name email phoneNumber role")
    .lean();

  return res.status(200).json(
    new ApiResponse(200, { booking: populated }, "Inspection booking cancelled")
  );
});

/**
 * @desc    Complete an inspection and record official score + domain report in MongoDB
 * @route   PATCH /api/v1/inspections/bookings/:id/complete
 * @access  Private (Admin only)
 */
export const completeInspectionBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid booking ID");
  }

  const booking = await InspectionBooking.findById(id);
  if (!booking) {
    throw new ApiError(404, "Inspection booking not found");
  }
  if (booking.status === "cancelled") {
    throw new ApiError(400, "Cannot complete a cancelled inspection booking");
  }

  await seedInspectionSystemIfEmpty();
  const standard = await InspectionStandard.findOne({
    key: "autobazaar_inspection_standard",
  }).lean();

  const roundedScore = Math.round(Number(req.body.score) * 10) / 10;
  const { grade, carInspectionStatus } = deriveGradeAndStatus(roundedScore, standard);

  const incomingDomains = req.body.domainScores || {};
  booking.score = roundedScore;
  booking.grade = grade;
  booking.status = "completed";
  booking.inspectorNotes = req.body.inspectorNotes || "";
  booking.inspectedBy = req.user._id;
  booking.completedAt = new Date();
  booking.domainScores = {
    engine: incomingDomains.engine ?? roundedScore,
    chassis: incomingDomains.chassis ?? roundedScore,
    suspension: incomingDomains.suspension ?? roundedScore,
    interior: incomingDomains.interior ?? roundedScore,
    road: incomingDomains.road ?? roundedScore,
    documents: incomingDomains.documents ?? roundedScore,
  };

  await booking.save();

  // Send real-time notification with completed report score
  notifyOnInspectionUpdate({
    booking,
    status: "completed",
    score: roundedScore,
  }).catch((err) => console.error("Async inspection completed notification failed:", err));

  if (booking.car) {
    await Car.findByIdAndUpdate(booking.car, {
      inspectionScore: roundedScore,
      inspectionStatus: carInspectionStatus,
      lastInspectedAt: booking.completedAt,
      latestInspectionBooking: booking._id,
    });
  }

  await recordAuditLog({
    actor: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: "admin",
    },
    action: "INSPECTION_COMPLETED",
    actionCategory: "admin",
    summary: `Completed vehicle inspection for ${booking.vehicleLabel}: Score ${roundedScore}/10 (${grade})`,
    targetEntity: {
      entityType: "Inspection",
      entityId: String(booking._id),
      entityTitle: booking.vehicleLabel,
    },
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "AutoBazaar-Admin-Client",
    metadata: {
      score: roundedScore,
      grade,
      carId: booking.car ? String(booking.car) : null,
    },
  });

  const populated = await InspectionBooking.findById(booking._id)
    .populate("hub", "city name address baysLabel phone")
    .populate("car", "title make model year price city images inspectionScore inspectionStatus seller")
    .populate("user", "name email phoneNumber role")
    .populate("inspectedBy", "name email")
    .lean();

  return res.status(200).json(
    new ApiResponse(
      200,
      { booking: populated },
      `Inspection report recorded (${roundedScore}/10 - ${grade})`
    )
  );
});

