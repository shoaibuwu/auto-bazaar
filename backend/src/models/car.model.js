import mongoose from "mongoose";
import User from "./user.model.js";

const carSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Car title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    make: {
      type: String,
      required: [true, "Car make (brand) is required"],
      trim: true,
    },
    model: {
      type: String,
      required: [true, "Car model is required"],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, "Manufacturing year is required"],
      min: [1900, "Year must be 1900 or newer"],
      max: [new Date().getFullYear() + 1, "Year cannot be in the future"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be greater than or equal to 0"],
    },
    mileage: {
      type: Number,
      required: [true, "Mileage is required"],
      min: [0, "Mileage cannot be negative"],
    },
    fuelType: {
      type: String,
      required: [true, "Fuel type is required"],
      enum: {
        values: ["petrol", "diesel", "electric", "hybrid"],
        message: "{VALUE} is not a valid fuel type",
      },
    },
    transmission: {
      type: String,
      required: [true, "Transmission is required"],
      enum: {
        values: ["automatic", "manual"],
        message: "{VALUE} is not a valid transmission type",
      },
    },
    condition: {
      type: String,
      enum: ["new", "used"],
      default: "used",
    },
    city: {
      type: String,
      trim: true,
      default: "Lahore",
    },
    bodyType: {
      type: String,
      trim: true,
      default: "sedan",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    images: {
      type: [String], // Array of local paths, e.g. ["/uploads/cars/car-123.jpg"]
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "pending_review", "published", "rejected", "sold"],
      default: "draft",
    },
    rejectionReason: {
      type: String,
      default: "",
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A car listing must belong to a seller"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying in search (Compound indexes with status: 'published')
carSchema.index({ status: 1, createdAt: -1 });
carSchema.index({ seller: 1, status: 1 });
carSchema.index({ status: 1, price: 1 });
carSchema.index({ status: 1, make: 1, model: 1 });
carSchema.index({ status: 1, year: -1 });

const Car = mongoose.model("Car", carSchema);

export default Car;
