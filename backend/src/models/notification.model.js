import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient user is required"],
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: [
        "PRICE_DROP",
        "CITY_MATCH",
        "INSPECTION_UPDATE",
        "INQUIRY_MESSAGE",
        "OFFER_RECEIVED",
        "SYSTEM",
      ],
      default: "SYSTEM",
      index: true,
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: 500,
    },
    tag: {
      type: String,
      trim: true,
      default: "Update",
      maxlength: 40,
    },
    tagType: {
      type: String,
      enum: ["emerald", "blue", "purple", "amber", "gray"],
      default: "blue",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    link: {
      type: String,
      trim: true,
      default: "/notifications",
    },
    relatedCar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      default: null,
    },
    relatedInquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inquiry",
      default: null,
    },
    relatedInspection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InspectionBooking",
      default: null,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user's notifications sorted by recency
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;

