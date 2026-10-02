const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const { STEP_ORDER } = require("./workloadSummary.chain");
const {
  VerifySnapshotSchema,
} = require("#modules/4.02-studyLoad/_shared/verifySnapshotSchema");

const PositionGroupSchema = new mongoose.Schema(
  {
    professor: { type: Number, default: 0 },
    docent: { type: Number, default: 0 },
    seniorTeacher: { type: Number, default: 0 },
    assistant: { type: Number, default: 0 },
  },
  { _id: false },
);

const SupportSchema = new mongoose.Schema(
  {
    cabinetHead: { type: Number, default: 0 },
    laborant: { type: Number, default: 0 },
  },
  { _id: false },
);

const SummaryRowSchema = new mongoose.Schema(
  {
    no: { type: Number, required: true },
    departmentId: { type: String, default: "" },
    department: { type: String, default: "" },
    head: { type: String, default: "" },
    total: { type: Number, default: 0 },
    hourly: { type: Number, default: 0 },
    forDistribution: { type: Number, default: 0 },
    positions: { type: Number, default: 0 },
    dh: { type: PositionGroupSchema, default: () => ({}) },
    ts: { type: PositionGroupSchema, default: () => ({}) },
    supportTotal: { type: Number, default: 0 },
    support: { type: SupportSchema, default: () => ({}) },
  },
  { _id: false },
);

const SummaryTotalsSchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0 },
    hourly: { type: Number, default: 0 },
    forDistribution: { type: Number, default: 0 },
    positions: { type: Number, default: 0 },
    dh: { type: PositionGroupSchema, default: () => ({}) },
    ts: { type: PositionGroupSchema, default: () => ({}) },
    supportTotal: { type: Number, default: 0 },
    support: { type: SupportSchema, default: () => ({}) },
  },
  { _id: false },
);

const IncludedWorkloadSchema = new mongoose.Schema(
  {
    workload: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "workload",
      required: true,
    },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const WorkloadSummaryApprovalStepSchema = new mongoose.Schema({
  step: { type: String, enum: STEP_ORDER, required: true },
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
  comment: { type: String, default: null },
  signature: { type: String, default: null },
  eriSignature: { type: String, default: null },
  eriSerial: { type: String, default: null },
  eriSignedAt: { type: Date, default: null },
  date: { type: Date, default: null },
});

const STATUSES = ["draft", "in_review", "approved", "rejected", "superseded"];

const WorkloadSummarySchema = new mongoose.Schema(
  {
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
      index: true,
    },
    academicYearTitle: { type: String, default: "" },

    snapshot: {
      rows: { type: [SummaryRowSchema], default: [] },
      totals: { type: SummaryTotalsSchema, default: () => ({}) },
      rowCount: { type: Number, default: 0 },
      generatedAt: { type: Date, default: null },
      missingDepartments: { type: [String], default: [] },
    },

    includedWorkloads: { type: [IncludedWorkloadSchema], default: [] },

    approvalSteps: {
      type: [WorkloadSummaryApprovalStepSchema],
      default: () => STEP_ORDER.map((step) => ({ step })),
    },

    status: { type: String, enum: STATUSES, default: "draft", index: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },

    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "workloadSummary",
      default: null,
    },
    supersededAt: { type: Date, default: null },

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

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

WorkloadSummarySchema.plugin(mongoosePaginate);

WorkloadSummarySchema.index({ academicYear: 1, status: 1 });
WorkloadSummarySchema.index(
  { "verify.token": 1 },
  { unique: true, partialFilterExpression: { "verify.token": { $type: "string" } } },
);

module.exports = mongoose.model("workloadSummary", WorkloadSummarySchema);
module.exports.STATUSES = STATUSES;
module.exports.SummaryRowSchema = SummaryRowSchema;
