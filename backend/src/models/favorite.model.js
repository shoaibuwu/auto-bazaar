import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A favorite must belong to a user"],
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: [true, "A favorite must refer to a car listing"],
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: Prevents a user from favoriting the same car twice
favoriteSchema.index({ user: 1, car: 1 }, { unique: true });

const Favorite = mongoose.model("Favorite", favoriteSchema);

export default Favorite;
