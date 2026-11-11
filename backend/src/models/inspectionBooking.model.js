import mongoose from "mongoose";

export const INSPECTION_TIME_SLOTS = [
  "10:00 AM - 12:00 PM",
  "12:00 PM - 02:00 PM",
  "02:00 PM - 04:00 PM",
  "04:00 PM - 06:00 PM",
];

const domainScoresSchema = new mongoose.Schema(
  {
    engine: { type: Number, min: 0, max: 10, default: null },
    chassis: { type: Number, min: 0, max: 10, default: null },
    suspension: { type: Number, min: 0, max: 10, default: null },
    interior: { type: Number, min: 0, max: 10, default: null },
    road: { type: Number, min: 0, max: 10, default: null },
    documents: { type: Number, min: 0, max: 10, default: null },
  },
  { _id: false }
);

const inspectionBookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Booking user is required"],
      index: true,
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      default: null,
      index: true,
    },
    hub: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InspectionHub",
      required: [true, "Inspection hub is required"],
    },
    bookingType: {
      type: String,
      enum: ["buyer_pre_purchase", "seller_certification"],
      default: "buyer_pre_purchase",
    },
    vehicleLabel: {
      type: String,
      required: [true, "Vehicle make/model/year is required"],
      trim: true,
      maxlength: [140, "Vehicle label cannot exceed 140 characters"],
    },
    registrationCity: {
      type: String,
      required: [true, "Vehicle city is required"],
      trim: true,
      maxlength: [60, "City cannot exceed 60 characters"],
    },
    contactPhone: {
      type: String,
      required: [true, "Contact phone number is required"],
      trim: true,
      maxlength: [30, "Phone number cannot exceed 30 characters"],
    },
    preferredDate: {
      type: Date,
      required: [true, "Preferred inspection date is required"],
    },
    timeSlot: {
      type: String,
      enum: INSPECTION_TIME_SLOTS,
      required: [true, "Inspection time slot is required"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [600, "Notes cannot exceed 600 characters"],
      default: "",
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    grade: {
      type: String,
      enum: ["Pending", "Certified", "Verified", "Flagged"],
      default: "Pending",
    },
    domainScores: {
      type: domainScoresSchema,
      default: () => ({}),
    },
    inspectorNotes: {
      type: String,
      trim: true,
      maxlength: [1000, "Inspector notes cannot exceed 1000 characters"],
      default: "",
    },
    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

inspectionBookingSchema.index({ user: 1, createdAt: -1 });
inspectionBookingSchema.index({ car: 1, status: 1 });
inspectionBookingSchema.index({ status: 1, preferredDate: 1 });

const InspectionBooking = mongoose.model("InspectionBooking", inspectionBookingSchema);

export default InspectionBooking;

