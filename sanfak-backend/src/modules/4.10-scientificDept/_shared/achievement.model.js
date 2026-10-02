const mongoose = require("mongoose");

const ACHIEVEMENT_STATUSES = ["new", "approved", "rejected"];

const achievementBaseFields = () => ({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "department",
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "faculty",
  },

  academicYear: { type: String, default: "" },
  fileUrl: { type: String, default: "" },

  status: {
    type: String,
    enum: ACHIEVEMENT_STATUSES,
    default: "new",
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  approvedAt: { type: Date },
  rejectionReason: { type: String },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  rejectedByRole: { type: String, default: "" },

  active: { type: Boolean, default: true },
});

module.exports = { achievementBaseFields, ACHIEVEMENT_STATUSES };
