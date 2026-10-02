const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const ObjectId = mongoose.Schema.Types.ObjectId;

const ReportSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["workload", "distribution", "teachers", "workPlan", "summary"],
      required: true,
    },
    title: { type: String, default: null },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
    },

    filters: {
      department:       { type: String, default: null },
      faculty:          { type: String, default: null },
      status:           { type: String, default: null },
      hrApprovalStatus: { type: String, default: null },
      teacher:          { type: String, default: null },
    },

    createdBy:   { type: ObjectId, ref: "user", default: null },
    submittedBy: { type: ObjectId, ref: "user", default: null },
    submittedAt: { type: Date, default: null },

    approvedBy:       { type: ObjectId, ref: "user", default: null },
    approvalDate:     { type: Date, default: null },
    approvalComment:  { type: String, default: null },

    rejectedBy:        { type: ObjectId, ref: "user", default: null },
    rejectionDate:     { type: Date, default: null },
    rejectionComment:  { type: String, default: null },

    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },

    fileUrl:   { type: String, default: null },
    fileFormat: {
      type: String,
      enum: ["excel", "pdf", null],
      default: null,
    },

    description: { type: String, default: null },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ReportSchema.index({ type: 1, status: 1 });
ReportSchema.index({ academicYear: 1 });
ReportSchema.index({ createdBy: 1 });

ReportSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("report", ReportSchema);
