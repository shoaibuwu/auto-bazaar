import Inquiry from "../models/inquiry.model.js";
import Car from "../models/car.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getIO } from "../socket/socket.js";
import { notifyOnChatMessage } from "../utils/notification.util.js";

const POPULATE_CAR_FIELDS =
  "title price images make model year city mileage fuel transmission status";
const POPULATE_USER_FIELDS = "name email phoneNumber avatar";

/**
 * Helper: Ensure legacy single-message inquiries have a valid messages[] array,
 * and apply per-participant deletion cutoff so deleted history stays hidden for the user who deleted it.
 */
function formatInquiryForResponse(inquiryDoc, viewerUserId = null) {
  const obj =
    typeof inquiryDoc.toObject === "function"
      ? inquiryDoc.toObject()
      : { ...inquiryDoc };
  const buyerId = String(obj.buyer?._id || obj.buyer || "");
  const sellerId = String(obj.seller?._id || obj.seller || "");

  if (!Array.isArray(obj.messages) || obj.messages.length === 0) {
    obj.messages = [
      {
        _id: obj._id,
        sender: buyerId,
        text: obj.message,
        messageType: "text",
        offerPrice: null,
        readBy: obj.status === "read" ? [buyerId, sellerId] : [buyerId],
        createdAt: obj.createdAt,
      },
    ];
  }

  // Filter out messages older than the viewer's own delete cutoff (if they deleted earlier and re-opened later)
  if (viewerUserId) {
    const viewerStr = String(viewerUserId);
    const isViewerSeller = viewerStr === sellerId;
    const cutoff = isViewerSeller ? obj.sellerDeletedAt : obj.buyerDeletedAt;

    if (cutoff) {
      const cutoffTime = new Date(cutoff).getTime();
      obj.messages = obj.messages.filter(
        (m) => new Date(m.createdAt).getTime() > cutoffTime
      );
    }
  }

  if (obj.messages.length > 0) {
    const newest = obj.messages[obj.messages.length - 1];
    if (!obj.lastMessage) {
      obj.lastMessage =
        newest.messageType === "offer" && newest.offerPrice
          ? `Offer: PKR ${Number(newest.offerPrice).toLocaleString("en-PK")} — ${newest.text}`
          : newest.text;
    }
    if (!obj.lastMessageAt) {
      obj.lastMessageAt = newest.createdAt || obj.updatedAt || obj.createdAt;
    }
  } else {
    if (!obj.lastMessage) obj.lastMessage = obj.message;
    if (!obj.lastMessageAt) obj.lastMessageAt = obj.updatedAt || obj.createdAt;
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
  const { message, phone, messageType = "text", offerPrice } = req.body;
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
  const resolvedOfferPrice =
    messageType === "offer" && offerPrice ? Number(offerPrice) : null;
  const lastSummary =
    messageType === "offer" && resolvedOfferPrice
      ? `Offer: PKR ${resolvedOfferPrice.toLocaleString("en-PK")} — ${message}`
      : message;

  // Check if a thread already exists for this car + buyer
  let inquiry = await Inquiry.findOne({
    car: car._id,
    buyer: currentUserId,
  });

  let isNewThread = false;
  let wasHiddenForSeller = false;
  let wasHiddenForBuyer = false;

  if (inquiry) {
    ensureLegacyMessagesBackfilled(inquiry);
    wasHiddenForSeller = Boolean(inquiry.deletedBySeller);
    wasHiddenForBuyer = Boolean(inquiry.deletedByBuyer);

    // Re-surface thread for whichever side wants to see the new message (deletedAt cutoff preserves history isolation)
    inquiry.deletedByBuyer = false;
    inquiry.deletedBySeller = false;

    inquiry.messages.push({
      sender: currentUserId,
      text: message,
      messageType: messageType || "text",
      offerPrice: resolvedOfferPrice,
      readBy: [currentUserId],
      createdAt: now,
    });
    inquiry.lastMessage = lastSummary;
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
          messageType: messageType || "text",
          offerPrice: resolvedOfferPrice,
          readBy: [currentUserId],
          createdAt: now,
        },
      ],
      lastMessage: lastSummary,
      lastMessageAt: now,
      lastSender: currentUserId,
      unreadByBuyer: 0,
      unreadBySeller: 1,
      phone: resolvedPhone,
      status: "unread",
    });
  }

  const populated = await populateInquiry(inquiry._id);
  const buyerIdStr = currentUserId.toString();
  const sellerIdStr = car.seller.toString();

  const buyerFormatted = formatInquiryForResponse(populated, buyerIdStr);
  const sellerFormatted = formatInquiryForResponse(populated, sellerIdStr);
  const latestMessage =
    buyerFormatted.messages[buyerFormatted.messages.length - 1];

  // Broadcast live event over Socket.IO
  const io = getIO();
  if (io) {
    const threadIdStr = buyerFormatted._id.toString();

    if (isNewThread || wasHiddenForSeller) {
      io.to(`user:${sellerIdStr}`).emit("inquiry:new", {
        inquiry: sellerFormatted,
      });
    } else {
      io.to(`user:${sellerIdStr}`).emit("inquiry:updated", {
        inquiryId: threadIdStr,
        message: latestMessage,
        inquiry: sellerFormatted,
      });
    }

    if (isNewThread || wasHiddenForBuyer) {
      io.to(`user:${buyerIdStr}`).emit("inquiry:new", {
        inquiry: buyerFormatted,
      });
    } else {
      io.to(`user:${buyerIdStr}`).emit("inquiry:updated", {
        inquiryId: threadIdStr,
        message: latestMessage,
        inquiry: buyerFormatted,
      });
    }

    if (!isNewThread) {
      io.to(`thread:${threadIdStr}`).emit("inquiry:message", {
        inquiryId: threadIdStr,
        message: latestMessage,
      });
    }
  }

  // Create persistent notification for seller
  notifyOnChatMessage({
    inquiry: populated,
    sender: req.user,
    text: message,
    messageType,
    offerPrice: resolvedOfferPrice,
  }).catch((err) => console.error("Async chat notification failed:", err));

  return res.status(isNewThread ? 201 : 200).json(
    new ApiResponse(
      isNewThread ? 201 : 200,
      { inquiry: buyerFormatted },
      "Inquiry sent to seller successfully"
    )
  );
});

/**
 * @desc    Get user's inquiries (excludes chats deleted by the current user)
 * @route   GET /api/v1/inquiries
 * @access  Private (Requires login)
 */
export const getMyInquiries = asyncHandler(async (req, res) => {
  const { role } = req.query; // 'seller' | 'buyer'
  const userId = req.user._id;
  const userIdStr = userId.toString();

  let query = {};
  if (role === "seller") {
    query = { seller: userId, deletedBySeller: { $ne: true } };
  } else if (role === "buyer") {
    query = { buyer: userId, deletedByBuyer: { $ne: true } };
  } else {
    query = {
      $or: [
        { seller: userId, deletedBySeller: { $ne: true } },
        { buyer: userId, deletedByBuyer: { $ne: true } },
      ],
    };
  }

  const rawInquiries = await Inquiry.find(query)
    .populate("car", POPULATE_CAR_FIELDS)
    .populate("buyer", POPULATE_USER_FIELDS)
    .populate("seller", POPULATE_USER_FIELDS)
    .sort({ lastMessageAt: -1, createdAt: -1 });

  const inquiries = rawInquiries.map((doc) =>
    formatInquiryForResponse(doc, userIdStr)
  );

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

  const isSeller = currentUserId === sellerId;
  if ((isSeller && inquiry.deletedBySeller) || (!isSeller && inquiry.deletedByBuyer)) {
    throw new ApiError(404, "Inquiry has been deleted from your inbox");
  }

  ensureLegacyMessagesBackfilled(inquiry);

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

  const formatted = formatInquiryForResponse(inquiry, currentUserId);

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

  // If either side deleted previously, sending a fresh reply re-opens visibility (cutoff keeps old history hidden for whoever deleted it)
  inquiry.deletedByBuyer = false;
  inquiry.deletedBySeller = false;

  const newMessageObj = {
    sender: req.user._id,
    text,
    messageType: messageType || "text",
    offerPrice:
      messageType === "offer" && offerPrice ? Number(offerPrice) : null,
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
  const buyerFormatted = formatInquiryForResponse(populated, buyerId);
  const sellerFormatted = formatInquiryForResponse(populated, sellerId);
  const viewerFormatted = isSenderBuyer ? buyerFormatted : sellerFormatted;
  const savedMessage =
    viewerFormatted.messages[viewerFormatted.messages.length - 1];

  // Emit real-time Socket.IO events tailored per participant
  const io = getIO();
  if (io) {
    const threadIdStr = viewerFormatted._id.toString();

    io.to(`thread:${threadIdStr}`).emit("inquiry:message", {
      inquiryId: threadIdStr,
      message: savedMessage,
    });

    io.to(`user:${buyerId}`).emit("inquiry:updated", {
      inquiryId: threadIdStr,
      message: savedMessage,
      inquiry: buyerFormatted,
    });

    io.to(`user:${sellerId}`).emit("inquiry:updated", {
      inquiryId: threadIdStr,
      message: savedMessage,
      inquiry: sellerFormatted,
    });
  }

  // Create persistent notification for the recipient
  notifyOnChatMessage({
    inquiry,
    sender: req.user,
    text,
    messageType,
    offerPrice: newMessageObj.offerPrice,
  }).catch((err) => console.error("Async chat reply notification failed:", err));

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        message: savedMessage,
        inquiry: viewerFormatted,
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
 * @desc    Delete an inquiry ONLY for the requesting user (keeps counterpart's copy intact)
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
  const now = new Date();

  if (currentUserId === buyerId) {
    inquiry.deletedByBuyer = true;
    inquiry.buyerDeletedAt = now;
    inquiry.unreadByBuyer = 0;
  }

  if (currentUserId === sellerId) {
    inquiry.deletedBySeller = true;
    inquiry.sellerDeletedAt = now;
    inquiry.unreadBySeller = 0;
  }

  // Only hard-delete from MongoDB when BOTH participants have deleted the chat
  if (inquiry.deletedByBuyer && inquiry.deletedBySeller) {
    await inquiry.deleteOne();
  } else {
    await inquiry.save();
  }

  // Only notify the user who deleted it — leave the other participant's inbox untouched
  const io = getIO();
  if (io) {
    io.to(`user:${currentUserId}`).emit("inquiry:deleted", {
      inquiryId: inquiryIdStr,
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "Conversation removed from your inbox"
      )
    );
});
