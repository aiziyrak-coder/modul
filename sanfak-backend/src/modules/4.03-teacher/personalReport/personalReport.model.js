const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const ReportApprovalStepSchema = require("../_shared/planApprovalStep.schema");

const REPORT_APPROVAL_STEPS = [
  { step: "dekan", label: "Fakultet dekani" },
  { step: "kotib", label: "Fakultet ilmiy kengash kotibi" },
];

function buildDefaultReportApprovals() {
  return REPORT_APPROVAL_STEPS.map(({ step, label }) => ({
    step,
    label,
    status: "pending",
  }));
}

const PersonalReportSchema = new mongoose.Schema(
  {
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "personalWorkPlan",
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
    },
    semester: { type: Number, enum: [1, 2], required: true },
    text: { type: String, required: true },
    councilDecisionFile: { type: String, default: null },

    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
    approvals: { type: [ReportApprovalStepSchema], default: [] },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

PersonalReportSchema.plugin(mongoosePaginate);

PersonalReportSchema.index({ plan: 1 });
PersonalReportSchema.index({ teacher: 1, academicYear: 1, semester: 1 });

function fillDefaultReportApprovals(next) {
  if (this.isNew && (!this.approvals || this.approvals.length === 0)) {
    this.approvals = buildDefaultReportApprovals();
  }
  next();
}
PersonalReportSchema.pre("save", fillDefaultReportApprovals);

module.exports = mongoose.model("personalReport", PersonalReportSchema);
module.exports.REPORT_APPROVAL_STEPS = REPORT_APPROVAL_STEPS;
module.exports.buildDefaultReportApprovals = buildDefaultReportApprovals;
module.exports.fillDefaultReportApprovals = fillDefaultReportApprovals;
