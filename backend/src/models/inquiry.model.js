import mongoose from "mongoose";

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
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [5, "Message must be at least 5 characters long"],
      maxlength: [1000, "Message cannot exceed 1000 characters"],
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

// Indexes for fast mailbox lookup
inquirySchema.index({ seller: 1, status: 1 });
inquirySchema.index({ buyer: 1, createdAt: -1 });

const Inquiry = mongoose.model("Inquiry", inquirySchema);

export default Inquiry;
