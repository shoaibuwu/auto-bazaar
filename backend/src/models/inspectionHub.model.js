import mongoose from "mongoose";

const inspectionHubSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: [true, "Hub city name is required"],
      unique: true,
      trim: true,
    },
    cityTags: {
      type: [String],
      default: [],
    },
    name: {
      type: String,
      required: [true, "Hub facility name is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Hub address is required"],
      trim: true,
    },
    hours: {
      type: String,
      required: [true, "Operating hours are required"],
      trim: true,
    },
    baysCount: {
      type: Number,
      required: true,
      min: 1,
      default: 3,
    },
    baysLabel: {
      type: String,
      trim: true,
      default: "3 Diagnostic Lift Bays",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

inspectionHubSchema.index({ isActive: 1, sortOrder: 1 });

const InspectionHub = mongoose.model("InspectionHub", inspectionHubSchema);

export default InspectionHub;

