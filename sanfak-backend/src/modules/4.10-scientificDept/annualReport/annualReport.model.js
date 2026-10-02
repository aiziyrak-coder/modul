const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const PLAN_STATUSES = ["new", "pending", "approved", "rejected"];

const AnnualReportSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      required: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
    },
    fileUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: PLAN_STATUSES,
      default: "new",
    },
    dekanApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    dekanApprovedAt: {
      type: Date,
    },
    prorektorApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    prorektorApprovedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    rejectedByRole: {
      type: String,
      default: "",
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

AnnualReportSchema.plugin(mongoosePaginate);
AnnualReportSchema.plugin(aggregatePaginate);

const model = mongoose.model("annualReport", AnnualReportSchema);
model.PLAN_STATUSES = PLAN_STATUSES;

module.exports = model;
