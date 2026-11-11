import mongoose from "mongoose";

const inspectionCheckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tool: { type: String, required: true, trim: true },
    standard: { type: String, required: true, trim: true },
    critical: { type: Boolean, default: false },
  },
  { _id: false }
);

const inspectionDomainSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    points: { type: Number, required: true, min: 1 },
    icon: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    checks: { type: [inspectionCheckSchema], default: [] },
  },
  { _id: false }
);

const paintScaleTierSchema = new mongoose.Schema(
  {
    range: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    detail: { type: String, required: true, trim: true },
    tone: { type: String, enum: ["emerald", "amber", "rose"], default: "emerald" },
  },
  { _id: false }
);

const gradingRuleSchema = new mongoose.Schema(
  {
    scoreRange: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    statusLabel: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    tone: { type: String, enum: ["emerald", "neutral", "rose"], default: "emerald" },
  },
  { _id: false }
);

const inspectionStandardSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "autobazaar_inspection_standard",
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    minimumApprovedScore: {
      type: Number,
      default: 7.5,
      min: 0,
      max: 10,
    },
    certifiedThresholdScore: {
      type: Number,
      default: 9.0,
      min: 0,
      max: 10,
    },
    domains: {
      type: [inspectionDomainSchema],
      default: [],
    },
    paintScale: {
      type: [paintScaleTierSchema],
      default: [],
    },
    gradingRules: {
      type: [gradingRuleSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const InspectionStandard = mongoose.model("InspectionStandard", inspectionStandardSchema);

export default InspectionStandard;

