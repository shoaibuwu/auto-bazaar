import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        default: "",
      },
      role: {
        type: String,
        enum: ["admin", "seller", "buyer", "system"],
        default: "admin",
      },
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    actionCategory: {
      type: String,
      enum: ["admin", "listing", "user", "security", "auth"],
      default: "admin",
      index: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    targetEntity: {
      entityType: {
        type: String,
        enum: ["Listing", "User", "Inquiry", "Inspection", "Security", "System"],
        default: "Listing",
      },
      entityId: {
        type: String,
        default: "",
      },
      entityTitle: {
        type: String,
        default: "",
      },
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1",
    },
    userAgent: {
      type: String,
      default: "AutoBazaar-Admin-Client",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    previousHash: {
      type: String,
      default: "GENESIS_HASH_00000000000000000000000000000000000000000000000000000000",
    },
    hash: {
      type: String,
      required: true,
      unique: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast searching and filtering
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ actionCategory: 1, timestamp: -1 });
auditLogSchema.index({ "actor.name": "text", summary: "text", "targetEntity.entityTitle": "text" });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;

