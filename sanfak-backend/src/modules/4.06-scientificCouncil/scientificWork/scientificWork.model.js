const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const DocFileSchema = new mongoose.Schema(
  {
    uploaded: { type: Boolean, default: false },
    fileName: { type: String },
    filePath: { type: String },
    uploadedAt: { type: Date },
    version: { type: Number, default: 1 },
  },
  { _id: false },
);

const AuditEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    role: { type: String },
    date: { type: Date, default: Date.now },
    detail: { type: String },
  },
  { _id: false },
);

const DecisionHistorySchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: ["seminar", "revision", "rejected"],
      required: true,
    },
    date: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    comment: { type: String },
    revisionDocs: [{ type: String }],
    seminarDate: { type: Date },
  },
  { _id: false },
);

const SupervisorSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["internal", "external"],
      default: "internal",
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    name: { type: String },
    workplace: { type: String },
    position: { type: String },
    academicTitle: { type: String },
    degree: { type: String },
    email: { type: String },
    phone: { type: String },
  },
  { _id: false },
);

const ScientificWorkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    titleRu: { type: String },
    year: { type: String },
    authorType: {
      type: String,
      enum: ["internal", "external"],
      default: "internal",
    },
    researcher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    externalAuthor: {
      name: { type: String },
      workplace: { type: String },
      position: { type: String },
      passportSeries: { type: String },
      passportNumber: { type: String },
      pinfl: { type: String },
      email: { type: String },
      phone: { type: String },
      provisionedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
    },
    supervisor: { type: SupervisorSchema, default: undefined },
    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "sciCouncilSpecialty",
      default: null,
    },
    type: { type: String },
    workFile: { type: DocFileSchema, default: undefined },
    councilMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    docAssignments: {
      type: Map,
      of: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
      default: {},
    },
    documents: {
      type: Map,
      of: DocFileSchema,
      default: {},
    },
    status: {
      type: String,
      enum: [
        "new",
        "accepted",
        "pending",
        "reviewed",
        "not_evaluated",
        "not_recommended",
        "rejected",
        "revision",
      ],
      default: "new",
    },
    protocol: {
      generatedAt: { type: Date },
      signedAt: { type: Date },
      signedBy: { type: String },
      eImzoSigned: { type: Boolean, default: false },
      eImzoCert: { type: String },
      immutable: { type: Boolean, default: false },
      intro: { type: String },
      finalConclusion: { type: String },
    },
    finalDecision: {
      type: String,
      enum: ["seminar", "revision", "rejected", null],
      default: null,
    },
    seminarDate: { type: Date },
    seminarResult: {
      type: String,
      enum: ["defended", "not_defended", null],
      default: null,
    },
    defenseDate: { type: Date },
    defenseResult: {
      type: String,
      enum: ["defended", "not_defended", null],
      default: null,
    },
    rejectionReason: { type: String },
    revisionComment: { type: String },
    revisionDocs: [{ type: String }],
    revisionDocsFixed: [{ type: String }],
    decisionHistory: [DecisionHistorySchema],
    auditLog: [AuditEntrySchema],
    secretary: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ScientificWorkSchema.plugin(mongoosePaginate);
ScientificWorkSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("scientificWork", ScientificWorkSchema);
