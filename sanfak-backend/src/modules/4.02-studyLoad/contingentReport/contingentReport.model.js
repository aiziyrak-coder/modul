"use strict";

const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const { STEP_ORDER, buildChainSteps } = require("./contingentReport.chain");
const {
  VerifySnapshotSchema,
} = require("#modules/4.02-studyLoad/_shared/verifySnapshotSchema");

const CATEGORIES = ["milliy", "mdh", "xorijiy", "xorijiy_gibrid"];
const CATEGORY_LABELS = {
  milliy: "milliy",
  mdh: "MDH",
  xorijiy: "xorijiy",
  xorijiy_gibrid: "xorijiy gibrid",
};

const SOURCES = ["groups", "manual"];
const STATUSES = ["draft", "in_review", "approved", "rejected"];
const MAX_COURSE = 6;

const RowSourceSchema = new mongoose.Schema(
  {
    total: { type: String, enum: SOURCES, default: "manual" },
    groupCount: { type: String, enum: SOURCES, default: "manual" },
    streamCount: { type: String, enum: SOURCES, default: "manual" },
  },
  { _id: false },
);

const num = { type: Number, default: 0, min: 0 };

const ContingentRowSchema = new mongoose.Schema(
  {
    direction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "direction",
      required: true,
    },
    directionCode: { type: String, default: "" },
    directionTitle: { type: String, default: "" },
    category: { type: String, enum: CATEGORIES, default: "milliy" },
    course: { type: Number, required: true, min: 1, max: MAX_COURSE },
    total: num,
    boys: num,
    girls: num,
    grant: num,
    contract: num,
    grantBoys: num,
    grantGirls: num,
    contractBoys: num,
    contractGirls: num,
    groupCount: num,
    streamCount: num,
    mobilityOut: num,
    mobilityIn: num,
    source: { type: RowSourceSchema, default: () => ({}) },
  },
  { _id: false },
);

const ForeignRowSchema = new mongoose.Schema(
  {
    country: { type: String, required: true, trim: true },
    total: num,
    boys: num,
    girls: num,
  },
  { _id: false },
);

const ContingentApprovalStepSchema = new mongoose.Schema({
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
  protocol: { type: String, default: null },
  signature: { type: String, default: null },
  eriSignature: { type: String, default: null },
  eriSerial: { type: String, default: null },
  eriSignedAt: { type: Date, default: null },
  date: { type: Date, default: null },
});

const ContingentReportSchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
      required: true,
      index: true,
    },
    facultyTitle: { type: String, default: "" },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
      index: true,
    },
    academicYearTitle: { type: String, default: "" },

    asOfDate: { type: Date, default: () => new Date() },
    level: { type: String, default: "bakalavr" },
    educationForm: { type: String, default: "kunduzgi" },

    rows: { type: [ContingentRowSchema], default: [] },
    foreignByCountry: { type: [ForeignRowSchema], default: [] },

    status: { type: String, enum: STATUSES, default: "draft", index: true },
    approvalSteps: {
      type: [ContingentApprovalStepSchema],
      default: buildChainSteps,
    },
    submittedAt: { type: Date, default: null },
    lastPrefilledAt: { type: Date, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
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

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ContingentReportSchema.plugin(mongoosePaginate);

ContingentReportSchema.index(
  { faculty: 1, academicYear: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
ContingentReportSchema.index({ academicYear: 1, status: 1 });
ContingentReportSchema.index(
  { "verify.token": 1 },
  { unique: true, partialFilterExpression: { "verify.token": { $type: "string" } } },
);

module.exports = mongoose.model("contingentReport", ContingentReportSchema);
module.exports.STATUSES = STATUSES;
module.exports.CATEGORIES = CATEGORIES;
module.exports.CATEGORY_LABELS = CATEGORY_LABELS;
module.exports.SOURCES = SOURCES;
module.exports.MAX_COURSE = MAX_COURSE;
