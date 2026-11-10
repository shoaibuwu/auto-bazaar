import Inquiry from "../models/inquiry.model.js";
import Car from "../models/car.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getIO } from "../socket/socket.js";

const POPULATE_CAR_FIELDS = "title price images make model year city mileage fuel transmission status";
const POPULATE_USER_FIELDS = "name email phoneNumber avatar";

/**
 * Helper: Ensure legacy single-message inquiries have a valid messages[] array in API responses
 */
function formatInquiryForResponse(inquiryDoc) {
  const obj = typeof inquiryDoc.toObject === "function" ? inquiryDoc.toObject() : { ...inquiryDoc };
  const buyerId = obj.buyer?._id || obj.buyer;

  if (!Array.isArray(obj.messages) || obj.messages.length === 0) {
    obj.messages = [
      {
        _id: obj._id,
        sender: buyerId,
        text: obj.message,
        messageType: "text",
        offerPrice: null,
        readBy: obj.status === "read" ? [buyerId, obj.seller?._id || obj.seller] : [buyerId],
        createdAt: obj.createdAt,
      },
    ];
  }

  if (!obj.lastMessage) {
    obj.lastMessage = obj.message;
  }
  if (!obj.lastMessageAt) {
    obj.lastMessageAt = obj.updatedAt || obj.createdAt;
  }
  if (typeof obj.unreadBySeller !== "number") {
    obj.unreadBySeller = obj.status === "unread" ? 1 : 0;
  }
  if (typeof obj.unreadByBuyer !== "number") {
    obj.unreadByBuyer = 0;
  }

  return obj;
}

/**
 * Helper: Backfill legacy single-message into messages[] before mutating/saving
 */
function ensureLegacyMessagesBackfilled(inquiry) {
  if (!inquiry.messages || inquiry.messages.length === 0) {
    inquiry.messages = [
      {
        sender: inquiry.buyer?._id || inquiry.buyer,
        text: inquiry.message,
        messageType: "text",
        readBy:
          inquiry.status === "read"
            ? [inquiry.buyer?._id || inquiry.buyer, inquiry.seller?._id || inquiry.seller]
            : [inquiry.buyer?._id || inquiry.buyer],
        createdAt: inquiry.createdAt || new Date(),
      },
    ];
  }
}

/**
 * Helper: Populate car, buyer, seller fields on an Inquiry document
 */
async function populateInquiry(inquiryId) {
  return await Inquiry.findById(inquiryId)
    .populate("car", POPULATE_CAR_FIELDS)
    .populate("buyer", POPULATE_USER_FIELDS)
    .populate("seller", POPULATE_USER_FIELDS);
}

/**
 * @desc    Send an inquiry to the car seller (creates or appends to existing thread for car+buyer)
 * @route   POST /api/v1/inquiries/:carId
 * @access  Private (Requires login)
 */
export const createInquiry = asyncHandler(async (req, res) => {
  const { carId } = req.params;
  const { message, phone } = req.body;
  const currentUserId = req.user._id;

  const car = await Car.findById(carId);

  if (!car) {
    throw new ApiError(404, "Car listing not found");
  }

  if (car.status !== "published") {
    throw new ApiError(
      400,
      `Cannot inquire about this listing. Current status: '${car.status}'`
    );
  }

  // Prevent contacting yourself
  if (car.seller.toString() === currentUserId.toString()) {
    throw new ApiError(
      400,
      "You cannot send an inquiry for your own car listing"
    );
  }

  const now = new Date();
  const resolvedPhone = phone || req.user.phoneNumber || "";

  // Check if an active thread already exists for this car + buyer
  let inquiry = await Inquiry.findOne({
    car: car._id,
    buyer: currentUserId,
  });

  let isNewThread = false;

  if (inquiry) {
    ensureLegacyMessagesBackfilled(inquiry);

    inquiry.messages.push({
      sender: currentUserId,
      text: message,
      messageType: "text",
      readBy: [currentUserId],
      createdAt: now,
    });
    inquiry.lastMessage = message;
    inquiry.lastMessageAt = now;
    inquiry.lastSender = currentUserId;
    inquiry.unreadBySeller = (inquiry.unreadBySeller || 0) + 1;
    inquiry.unreadByBuyer = 0;
    inquiry.status = "unread";
    if (resolvedPhone) inquiry.phone = resolvedPhone;

    await inquiry.save();
  } else {
    isNewThread = true;
    inquiry = await Inquiry.create({
      car: car._id,
      buyer: currentUserId,
      seller: car.seller,
      message,
      messages: [
        {
          sender: currentUserId,
          text: message,
          messageType: "text",
          readBy: [currentUserId],
          createdAt: now,
        },
      ],
      lastMessage: message,
      lastMessageAt: now,
      lastSender: currentUserId,
      unreadByBuyer: 0,
      unreadBySeller: 1,
      phone: resolvedPhone,
      status: "unread",
    });
  }

  const populated = await populateInquiry(inquiry._id);
  const formatted = formatInquiryForResponse(populated);
  const latestMessage = formatted.messages[formatted.messages.length - 1];

  // Broadcast live event over Socket.IO
  const io = getIO();
  if (io) {
    const buyerIdStr = currentUserId.toString();
    const sellerIdStr = car.seller.toString();
    const threadIdStr = formatted._id.toString();

    if (isNewThread) {
      io.to(`user:${sellerIdStr}`).emit("inquiry:new", { inquiry: formatted });
      io.to(`user:${buyerIdStr}`).emit("inquiry:new", { inquiry: formatted });
    } else {
      io.to(`thread:${threadIdStr}`).emit("inquiry:message", {
        inquiryId: threadIdStr,
        message: latestMessage,
        inquiry: formatted,
      });
      io.to(`user:${sellerIdStr}`).emit("inquiry:updated", {
        inquiryId: threadIdStr,
        message: latestMessage,
        inquiry: formatted,
      });
      io.to(`user:${buyerIdStr}`).emit("inquiry:updated", {
        inquiryId: threadIdStr,
        message: latestMessage,
        inquiry: formatted,
      });
    }
  }

  return res.status(isNewThread ? 201 : 200).json(
    new ApiResponse(
      isNewThread ? 201 : 200,
      { inquiry: formatted },
      "Inquiry sent to seller successfully"
    )
  );
});

/**
 * @desc    Get user's inquiries (Supports filtering as 'seller' or 'buyer')
 * @route   GET /api/v1/inquiries
 * @access  Private (Requires login)
 */
export const getMyInquiries = asyncHandler(async (req, res) => {
  const { role } = req.query; // 'seller' | 'buyer'
  const userId = req.user._id;
  const userIdStr = userId.toString();

  let query = {};
  if (role === "seller") {
    query = { seller: userId };
  } else if (role === "buyer") {
    query = { buyer: userId };
  } else {
    query = { $or: [{ seller: userId }, { buyer: userId }] };
  }

  const rawInquiries = await Inquiry.find(query)
    .populate("car", POPULATE_CAR_FIELDS)
    .populate("buyer", POPULATE_USER_FIELDS)
    .populate("seller", POPULATE_USER_FIELDS)
    .sort({ lastMessageAt: -1, createdAt: -1 });

  const inquiries = rawInquiries.map(formatInquiryForResponse);

  const totalUnread = inquiries.reduce((sum, inq) => {
    const sellerId = (inq.seller?._id || inq.seller)?.toString();
    const isSeller = sellerId === userIdStr;
    return sum + (isSeller ? inq.unreadBySeller || 0 : inq.unreadByBuyer || 0);
  }, 0);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        count: inquiries.length,
        totalUnread,
        inquiries,
      },
      "Inquiries retrieved successfully"
    )
  );
});

/**
 * @desc    Get a specific inquiry conversation & mark messages read for current viewer
 * @route   GET /api/v1/inquiries/:id
 * @access  Private (Participants only)
 */
export const getInquiryById = asyncHandler(async (req, res) => {
  const inquiry = await populateInquiry(req.params.id);

  if (!inquiry) {
    throw new ApiError(404, "Inquiry not found");
  }

  const currentUserId = req.user._id.toString();
  const buyerId = inquiry.buyer._id.toString();
  const sellerId = inquiry.seller._id.toString();

  if (currentUserId !== buyerId && currentUserId !== sellerId) {
    throw new ApiError(
      403,
      "Access forbidden: Only conversation participants can view this inquiry"
    );
  }

  ensureLegacyMessagesBackfilled(inquiry);

  const isSeller = currentUserId === sellerId;
  const otherUserId = isSeller ? buyerId : sellerId;
  let dirty = false;

  if (isSeller && (inquiry.unreadBySeller > 0 || inquiry.status === "unread")) {
    inquiry.unreadBySeller = 0;
    inquiry.status = "read";
    dirty = true;
  } else if (!isSeller && inquiry.unreadByBuyer > 0) {
    inquiry.unreadByBuyer = 0;
    dirty = true;
  }

  // Mark individual messages read by viewer
  inquiry.messages.forEach((msg) => {
    if (!msg.readBy.some((id) => id.toString() === currentUserId)) {
      msg.readBy.push(req.user._id);
      dirty = true;
    }
  });

  if (dirty) {
    await inquiry.save();

    const io = getIO();
    if (io) {
      const payload = {
        inquiryId: inquiry._id.toString(),
        readBy: currentUserId,
      };
      io.to(`thread:${inquiry._id.toString()}`).emit("inquiry:read", payload);
      io.to(`user:${otherUserId}`).emit("inquiry:read", payload);
    }
  }

  const formatted = formatInquiryForResponse(inquiry);

  return res.status(200).json(
    new ApiResponse(
      200,
      { inquiry: formatted },
      "Inquiry retrieved successfully"
    )
  );
});

/**
 * @desc    Send a reply message in an existing inquiry thread
 * @route   POST /api/v1/inquiries/:id/messages
 * @access  Private (Participants only)
 */
export const sendInquiryMessage = asyncHandler(async (req, res) => {
  const { text, messageType = "text", offerPrice } = req.body;
  const inquiry = await Inquiry.findById(req.params.id);

  if (!inquiry) {
    throw new ApiError(404, "Inquiry conversation not found");
  }

  const currentUserId = req.user._id.toString();
  const buyerId = inquiry.buyer.toString();
  const sellerId = inquiry.seller.toString();

  if (currentUserId !== buyerId && currentUserId !== sellerId) {
    throw new ApiError(
      403,
      "Access forbidden: Only conversation participants can send messages"
    );
  }

  ensureLegacyMessagesBackfilled(inquiry);

  const now = new Date();
  const isSenderBuyer = currentUserId === buyerId;
  const recipientId = isSenderBuyer ? sellerId : buyerId;

  const newMessageObj = {
    sender: req.user._id,
    text,
    messageType: messageType || "text",
    offerPrice: messageType === "offer" && offerPrice ? Number(offerPrice) : null,
    readBy: [req.user._id],
    createdAt: now,
  };

  inquiry.messages.push(newMessageObj);
  inquiry.lastMessage =
    newMessageObj.messageType === "offer" && newMessageObj.offerPrice
      ? `Offer: PKR ${newMessageObj.offerPrice.toLocaleString("en-PK")} — ${text}`
      : text;
  inquiry.lastMessageAt = now;
  inquiry.lastSender = req.user._id;

  if (isSenderBuyer) {
    inquiry.unreadBySeller = (inquiry.unreadBySeller || 0) + 1;
    inquiry.unreadByBuyer = 0;
    inquiry.status = "unread";
  } else {
    inquiry.unreadByBuyer = (inquiry.unreadByBuyer || 0) + 1;
    inquiry.unreadBySeller = 0;
    inquiry.status = "read";
  }

  await inquiry.save();

  const populated = await populateInquiry(inquiry._id);
  const formatted = formatInquiryForResponse(populated);
  const savedMessage = formatted.messages[formatted.messages.length - 1];

  // Emit real-time Socket.IO events
  const io = getIO();
  if (io) {
    const threadIdStr = formatted._id.toString();
    const payload = {
      inquiryId: threadIdStr,
      message: savedMessage,
      inquiry: formatted,
    };

    io.to(`thread:${threadIdStr}`).emit("inquiry:message", payload);
    io.to(`user:${recipientId}`).emit("inquiry:updated", payload);
    io.to(`user:${currentUserId}`).emit("inquiry:updated", payload);
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        message: savedMessage,
        inquiry: formatted,
      },
      "Reply sent successfully"
    )
  );
});

/**
 * @desc    Mark an inquiry thread as read for the current user
 * @route   PATCH /api/v1/inquiries/:id/read
 * @access  Private (Participants only)
 */
export const markInquiryAsRead = asyncHandler(async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.id);

  if (!inquiry) {
    throw new ApiError(404, "Inquiry not found");
  }

  const currentUserId = req.user._id.toString();
  const buyerId = inquiry.buyer.toString();
  const sellerId = inquiry.seller.toString();

  if (currentUserId !== buyerId && currentUserId !== sellerId) {
    throw new ApiError(403, "Access forbidden");
  }

  const isSeller = currentUserId === sellerId;
  const otherUserId = isSeller ? buyerId : sellerId;

  ensureLegacyMessagesBackfilled(inquiry);

  if (isSeller) {
    inquiry.unreadBySeller = 0;
    inquiry.status = "read";
  } else {
    inquiry.unreadByBuyer = 0;
  }

  inquiry.messages.forEach((msg) => {
    if (!msg.readBy.some((id) => id.toString() === currentUserId)) {
      msg.readBy.push(req.user._id);
    }
  });

  await inquiry.save();

  const io = getIO();
  if (io) {
    const payload = {
      inquiryId: inquiry._id.toString(),
      readBy: currentUserId,
    };
    io.to(`thread:${inquiry._id.toString()}`).emit("inquiry:read", payload);
    io.to(`user:${otherUserId}`).emit("inquiry:read", payload);
    io.to(`user:${currentUserId}`).emit("inquiry:read", payload);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { inquiryId: inquiry._id },
      "Conversation marked as read"
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

  const currentUserId = req.user._id.toString();
  const buyerId = inquiry.buyer.toString();
  const sellerId = inquiry.seller.toString();

  if (buyerId !== currentUserId && sellerId !== currentUserId) {
    throw new ApiError(
      403,
      "Access forbidden: You can only delete your own inquiries"
    );
  }

  const inquiryIdStr = inquiry._id.toString();
  await inquiry.deleteOne();

  const io = getIO();
  if (io) {
    const payload = { inquiryId: inquiryIdStr };
    io.to(`thread:${inquiryIdStr}`).emit("inquiry:deleted", payload);
    io.to(`user:${buyerId}`).emit("inquiry:deleted", payload);
    io.to(`user:${sellerId}`).emit("inquiry:deleted", payload);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Inquiry deleted successfully"));
});
