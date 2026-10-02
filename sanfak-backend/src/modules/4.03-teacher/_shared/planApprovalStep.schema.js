const mongoose = require("mongoose");

const PlanApprovalStepSchema = new mongoose.Schema(
  {
    step: { type: String },
    label: { type: String, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    date: { type: Date, default: null },
    comment: { type: String, default: null },
    eriSignature: { type: String, default: null },
    eriSerial: { type: String, default: null },
    eriSignedAt: { type: Date, default: null },
  },
  { _id: true },
);

module.exports = PlanApprovalStepSchema;
