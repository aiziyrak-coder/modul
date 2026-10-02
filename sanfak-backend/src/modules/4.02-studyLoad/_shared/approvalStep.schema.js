const mongoose = require("mongoose");

const ApprovalStepSchema = new mongoose.Schema(
  {
    step: {
      type: String,
      enum: ["methodical", "dean", "prorektor", "rektor"],
    },
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
    date:      { type: Date,   default: null },
    signature: { type: String, default: null },
    eriSignature: { type: String, default: null },
    eriSerial:    { type: String, default: null },
    eriSignedAt:  { type: Date,   default: null },
    comment:   { type: String, default: null },
  },
);

module.exports = ApprovalStepSchema;
