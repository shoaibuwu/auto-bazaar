import Inquiry from "../models/inquiry.model.js";
import Car from "../models/car.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * @desc    Send an inquiry to the car seller
 * @route   POST /api/v1/inquiries/:carId
 * @access  Private (Requires login)
 */
export const createInquiry = asyncHandler(async (req, res) => {
  const { carId } = req.params;
  const { message, phone } = req.body;

  const car = await Car.findById(carId);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  // Quality check: Car must be published
  if (car.status !== "published") {
    throw new ApiError(
      400,
      `Cannot inquire about this listing. Current status: '${car.status}'`
    );
  }

  // 🛡️ Roadmap Rule: "Can't contact yourself"
  if (car.seller.toString() === req.user._id.toString()) {
    throw new ApiError(
      400,
      "You cannot send an inquiry for your own car listing"
    );
  }

  const inquiry = await Inquiry.create({
    car: car._id,
    buyer: req.user._id,
    seller: car.seller,
    message,
    phone: phone || req.user.phoneNumber || "",
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      { inquiry },
      "Inquiry sent to seller successfully"
    )
  );
});

/**
 * @desc    Get user's inquiries (Supports filtering as 'buyer' or 'seller')
 * @route   GET /api/v1/inquiries
 * @access  Private (Requires login)
 */
export const getMyInquiries = asyncHandler(async (req, res) => {
  const { role } = req.query; // 'seller' | 'buyer'
  const userId = req.user._id;

  let query = {};
  if (role === "seller") {
    query = { seller: userId };
  } else if (role === "buyer") {
    query = { buyer: userId };
  } else {
    query = { $or: [{ seller: userId }, { buyer: userId }] };
  }

  const inquiries = await Inquiry.find(query)
    .populate("car", "title price images make model status")
    .populate("buyer", "name email phoneNumber avatar")
    .populate("seller", "name email phoneNumber avatar")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        count: inquiries.length,
        inquiries,
      },
      "Inquiries retrieved successfully"
    )
  );
});

/**
 * @desc    Get a specific inquiry conversation (Enforces participant-only read permission)
 * @route   GET /api/v1/inquiries/:id
 * @access  Private (Participants only)
 */
export const getInquiryById = asyncHandler(async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.id)
    .populate("car", "title price images make model status")
    .populate("buyer", "name email phoneNumber avatar")
    .populate("seller", "name email phoneNumber avatar");

  if (!inquiry) {
    throw new ApiError(404, "Inquiry not found");
  }

  // 🛡️ Roadmap Rule: "Only participants can read an inquiry"
  const currentUserId = req.user._id.toString();
  const buyerId = inquiry.buyer._id.toString();
  const sellerId = inquiry.seller._id.toString();

  if (currentUserId !== buyerId && currentUserId !== sellerId) {
    throw new ApiError(
      403,
      "Access forbidden: Only conversation participants can view this inquiry"
    );
  }

  // If the recipient seller opens an unread inquiry, mark it as read
  if (currentUserId === sellerId && inquiry.status === "unread") {
    inquiry.status = "read";
    await inquiry.save();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { inquiry },
      "Inquiry retrieved successfully"
    )
  );
});

/**
 * @desc    Delete an inquiry (Participants only)
 * @route   DELETE /api/v1/inquiries/:id
 * @access  Private (Participants only)
 */
export const deleteInquiry = asyncHandler(async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.id);

  if (!inquiry) {
    throw new ApiError(404, "Inquiry not found");
  }

  // Participant check
  const currentUserId = req.user._id.toString();
  if (
    inquiry.buyer.toString() !== currentUserId &&
    inquiry.seller.toString() !== currentUserId
  ) {
    throw new ApiError(
      403,
      "Access forbidden: You can only delete your own inquiries"
    );
  }

  await inquiry.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Inquiry deleted successfully"));
});
