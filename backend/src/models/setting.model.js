import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "autobazaar_main_config",
      unique: true,
    },
    marketplace: {
      platformName: {
        type: String,
        default: "AutoBazaar Pakistan",
        trim: true,
      },
      supportEmail: {
        type: String,
        default: "support@autobazaar.com",
        trim: true,
      },
      currency: {
        type: String,
        default: "PKR",
      },
      defaultCity: {
        type: String,
        default: "Lahore",
      },
      maintenanceMode: {
        type: Boolean,
        default: false,
      },
    },
    moderation: {
      requireApproval: {
        type: Boolean,
        default: true,
      },
      maxPhotosPerListing: {
        type: Number,
        default: 15,
        min: 1,
        max: 30,
      },
      minPricePkr: {
        type: Number,
        default: 100000, // PKR 1 Lac minimum
      },
      maxPricePkr: {
        type: Number,
        default: 500000000, // PKR 50 Crore maximum
      },
      restrictedKeywords: {
        type: [String],
        default: [
          "advance deposit",
          "token hold without seeing",
          "stolen",
          "non-custom",
          "fake document",
          "duplicate chassis",
        ],
      },
    },
    security: {
      sessionExpiryDays: {
        type: Number,
        default: 7,
      },
      enforceRateLimitProd: {
        type: Boolean,
        default: true,
      },
      devBypassEnabled: {
        type: Boolean,
        default: true,
      },
      auditLogLevel: {
        type: String,
        enum: ["standard", "verbose", "cryptographic_strict"],
        default: "cryptographic_strict",
      },
    },
    database: {
      lastCacheClear: {
        type: Date,
        default: Date.now,
      },
      connectedUri: {
        type: String,
        default: "mongodb://127.0.0.1:27017/auto-bazaar",
      },
      clusterNode: {
        type: String,
        default: "pk-isb-primary-node-01",
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Setting = mongoose.model("Setting", settingSchema);

export default Setting;

