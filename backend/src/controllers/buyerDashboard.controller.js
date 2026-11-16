import Inquiry from "../models/inquiry.model.js";
import InspectionBooking from "../models/inspectionBooking.model.js";
import InspectionHub from "../models/inspectionHub.model.js";
import Favorite from "../models/favorite.model.js";
import Car from "../models/car.model.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * @desc    Get aggregated Buyer Dashboard overview
 * @route   GET /api/v1/buyer-dashboard
 * @access  Private (Buyer/User)
 */
export const getBuyerDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userCity = req.user.city || "Lahore";

  // Execute queries in parallel from actual database records
  const [
    inquiriesRaw,
    appointmentsRaw,
    favoritesRaw,
    recommendedCars,
  ] = await Promise.all([
    // 1. Inquiries where user is buyer and not deleted
    Inquiry.find({ buyer: userId, deletedByBuyer: { $ne: true } })
      .populate("car", "title make model year price images city mileage fuelType transmission status")
      .populate("seller", "name phoneNumber avatar")
      .sort({ lastMessageAt: -1 })
      .lean(),

    // 2. Inspection Bookings
    InspectionBooking.find({ user: userId })
      .populate("hub", "city name address phone")
      .populate("car", "title make model year price images city inspectionScore")
      .sort({ preferredDate: -1 })
      .lean(),

    // 3. Saved Favorites
    Favorite.find({ user: userId })
      .populate({
        path: "car",
        populate: { path: "seller", select: "name phoneNumber avatar" },
      })
      .sort({ createdAt: -1 })
      .lean(),

    // 4. City-matched or popular recommended cars
    Car.find({
      status: "published",
      city: { $regex: new RegExp(`^${userCity.trim()}$`, "i") },
    })
      .populate("seller", "name phoneNumber avatar")
      .limit(4)
      .lean(),
  ]);

  // Format Inquiries as Buyer Dashboard Activity Records
  const formattedInquiries = inquiriesRaw.map((inq) => {
    const car = inq.car || {};
    const seller = inq.seller || {};
    const latestMsg = inq.messages?.[inq.messages.length - 1] || {};

    let status = "requested";
    let statusLabel = "Requested";
    if (inq.status === "read") {
      status = "accepted";
      statusLabel = "Accepted";
    }

    if (latestMsg.messageType === "offer") {
      status = "accepted";
      statusLabel = "Offer Submitted";
    }

    return {
      id: inq._id,
      category: "inquiries",
      type: "inquiry",
      title: car.title || "Vehicle Listing",
      make: car.make,
      model: car.model,
      year: car.year,
      price: car.price || 0,
      image: car.images?.[0] || "",
      city: car.city || "Pakistan",
      subtitle: car.transmission ? `${car.year || ""} • ${car.transmission}` : "Inquiry",
      partnerName: seller.name || "Verified Seller",
      partnerPhone: seller.phoneNumber || "",
      contextText: inq.lastMessage || "Direct chat inquiry",
      timeText: inq.lastMessageAt
        ? new Date(inq.lastMessageAt).toLocaleDateString("en-PK", { month: "short", day: "numeric" })
        : "Recent",
      status,
      statusLabel,
      unreadCount: inq.unreadByBuyer || 0,
      link: `/inquiries?id=${inq._id}`,
      actionLabel: "View Chat",
      actionIcon: "chat",
      rawInquiryId: inq._id,
      carId: car._id,
    };
  });

  // Format Inspection Bookings as Activity Records
  const formattedAppointments = appointmentsRaw.map((booking) => {
    const car = booking.car || {};
    const hub = booking.hub || {};

    let status = booking.status; // 'scheduled', 'in_progress', 'completed', 'cancelled'
    let statusLabel = "Scheduled";
    if (status === "scheduled") {
      status = "requested";
      statusLabel = "Scheduled";
    } else if (status === "completed") {
      statusLabel = `Completed (Score: ${booking.score || 9.4}/10)`;
    } else if (status === "cancelled") {
      statusLabel = "Cancelled";
    }

    const dateStr = booking.preferredDate
      ? new Date(booking.preferredDate).toLocaleDateString("en-PK", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "Upcoming";

    return {
      id: booking._id,
      category: "appointments",
      type: "appointment",
      title: booking.vehicleLabel || car.title || "Vehicle Inspection",
      make: car.make,
      model: car.model,
      year: car.year,
      price: car.price || 0,
      image: car.images?.[0] || "",
      city: booking.registrationCity || hub.city || "Pakistan",
      subtitle: booking.bookingType === "buyer_pre_purchase" ? "Doorstep 200-Pt Inspection" : "Certification",
      partnerName: hub.name || "AutoBazaar Inspection Hub",
      partnerPhone: hub.phone || "",
      contextText: `${dateStr} • ${booking.timeSlot || "Scheduled Slot"}`,
      timeText: dateStr,
      status,
      statusLabel,
      score: booking.score,
      link: `/inspections`,
      actionLabel: status === "completed" ? "Inspection Report" : "View Details",
      actionIcon: status === "completed" ? "description" : "visibility",
      bookingId: booking._id,
      carId: car._id,
    };
  });

  // Combined records for 'All Records' tab
  const allRecords = [...formattedInquiries, ...formattedAppointments].sort(
    (a, b) => (b.timeText > a.timeText ? 1 : -1)
  );

  // Compute KPI Stats
  const activeInquiriesCount = formattedInquiries.length;
  const newRepliesCount = formattedInquiries.filter((i) => i.unreadCount > 0).length;

  const totalAppointmentsCount = formattedAppointments.length;
  const upcomingAppointmentsCount = appointmentsRaw.filter(
    (b) => b.status === "scheduled" && new Date(b.preferredDate) >= new Date()
  ).length;

  const savedCarsCount = favoritesRaw.filter((f) => f.car).length;

  const completedScores = appointmentsRaw
    .filter((b) => b.status === "completed" && typeof b.score === "number")
    .map((b) => b.score);

  const avgInspectionScore = completedScores.length > 0
    ? (completedScores.reduce((a, b) => a + b, 0) / completedScores.length).toFixed(1)
    : null;

  // Formatted PakBuyer ID
  const buyerIdPill = `PK-${String(userId).slice(-5).toUpperCase()}`;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        buyerProfile: {
          id: userId,
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phoneNumber,
          city: userCity,
          avatar: req.user.avatar,
          buyerIdCode: buyerIdPill,
        },
        stats: {
          activeInquiries: activeInquiriesCount,
          newReplies: newRepliesCount,
          totalAppointments: totalAppointmentsCount,
          upcomingAppointments: upcomingAppointmentsCount,
          savedCars: savedCarsCount,
          avgInspectionScore,
          completedReportsCount: completedScores.length,
        },
        counts: {
          all: allRecords.length,
          inquiries: formattedInquiries.length,
          appointments: formattedAppointments.length,
          saved: savedCarsCount,
        },
        records: allRecords,
        inquiries: formattedInquiries,
        appointments: formattedAppointments,
        savedCars: favoritesRaw.filter((f) => f.car).map((f) => f.car),
        recommendedCars: (recommendedCars.length > 0
          ? recommendedCars
          : await Car.find({ status: "published" }).limit(4).lean()
        ),
      },
      "Buyer dashboard overview retrieved successfully"
    )
  );
});
