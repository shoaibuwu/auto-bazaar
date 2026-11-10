import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Message text is required"],
      trim: true,
      maxlength: [1500, "Message cannot exceed 1500 characters"],
    },
    messageType: {
      type: String,
      enum: ["text", "offer", "viewing"],
      default: "text",
    },
    offerPrice: {
      type: Number,
      default: null,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const inquirySchema = new mongoose.Schema(
  {
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: [true, "An inquiry must reference a car listing"],
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "An inquiry must have a buyer"],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "An inquiry must reference the listing seller"],
    },
    // Initial / summary message (preserved for backward compatibility)
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [2, "Message must be at least 2 characters long"],
      maxlength: [1500, "Message cannot exceed 1500 characters"],
    },
    // Full two-way real-time conversation thread
    messages: {
      type: [messageSchema],
      default: [],
    },
    lastMessage: {
      type: String,
      trim: true,
      default: "",
    },
    lastMessageAt: {
      type: Date,
    },
    lastSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    unreadByBuyer: {
      type: Number,
      default: 0,
      min: 0,
    },
    unreadBySeller: {
      type: Number,
      min: 0,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["unread", "read"],
      default: "unread",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast mailbox & thread lookup
inquirySchema.index({ seller: 1, lastMessageAt: -1 });
inquirySchema.index({ buyer: 1, lastMessageAt: -1 });
inquirySchema.index({ car: 1, buyer: 1 });

const Inquiry = mongoose.model("Inquiry", inquirySchema);

export default Inquiry;
