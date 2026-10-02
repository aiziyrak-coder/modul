const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const {
  VerifySnapshotSchema,
} = require("#modules/4.02-studyLoad/_shared/verifySnapshotSchema");

const TeacherLeaveSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    type: {
      type: String,
      enum: ["leave", "resignation", "transfer"],
      required: true,
    },

    reason: {
      type: String,
      default: null,
    },

    distribution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "workloadDistribution",
      default: null,
    },
    teacherEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    fromDate: {
      type: Date,
      default: null,
    },
    toDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    approvalDate: {
      type: Date,
      default: null,
    },
    approvalComment: {
      type: String,
      default: null,
    },

    verify: {
      token: { type: String },
      issuedAt: { type: Date, default: null },
      issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      revokedAt: { type: Date, default: null },
      revokedReason: { type: String, default: null },
      snapshot: { type: [VerifySnapshotSchema], default: [] },
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

TeacherLeaveSchema.plugin(mongoosePaginate);

TeacherLeaveSchema.index(
  { "verify.token": 1 },
  { unique: true, partialFilterExpression: { "verify.token": { $type: "string" } } },
);

module.exports = mongoose.model("teacherLeave", TeacherLeaveSchema);
