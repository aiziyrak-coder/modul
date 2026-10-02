const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const METHODICAL_FILE_SLOTS = [
  "methodical",
  "protocol",
  "titul",
  "external",
  "internal",
  "antiplagiat",
];

const METHODICAL_STATUSES = ["new", "pending", "approved", "rejected"];

const METHODICAL_SOURCES = ["internal", "public"];

const METHODICAL_REJECTER_ROLES = [
  "ilmiy_bolim",
  "ilmiy_kengash_kotibi",
  "rektor",
];

const MethodicalRecommendationSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    source: {
      type: String,
      enum: METHODICAL_SOURCES,
      default: "internal",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },
    direction: {
      type: String,
      default: "",
      trim: true,
    },

    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "methodicalSpecialty",
      default: null,
    },
    academicYear: {
      type: String,
      required: true,
    },

    submitterName: { type: String, trim: true, default: "" },
    submitterPhone: { type: String, trim: true, default: "" },
    submitterEmail: { type: String, trim: true, default: "" },
    submitterOrganization: { type: String, trim: true, default: "" },
    submitterDepartment: { type: String, trim: true, default: "" },

    files: {
      methodical: { type: String, default: "" },
      protocol: { type: String, default: "" },
      titul: { type: String, default: "" },
      external: { type: String, default: "" },
      internal: { type: String, default: "" },
      antiplagiat: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: METHODICAL_STATUSES,
      default: "new",
    },

    ilmiyApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    ilmiyApprovedAt: { type: Date },

    kotibSignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    kotibSignedAt: { type: Date },
    kotibEriSerial: { type: String },

    rektorSignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    rektorSignedAt: { type: Date },
    rektorEriSerial: { type: String },
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    rejectionReason: { type: String },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    rejectedByRole: { type: String, enum: METHODICAL_REJECTER_ROLES },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

MethodicalRecommendationSchema.plugin(mongoosePaginate);
MethodicalRecommendationSchema.plugin(aggregatePaginate);

const model = mongoose.model(
  "methodicalRecommendation",
  MethodicalRecommendationSchema,
);
model.METHODICAL_FILE_SLOTS = METHODICAL_FILE_SLOTS;
model.METHODICAL_STATUSES = METHODICAL_STATUSES;
model.METHODICAL_SOURCES = METHODICAL_SOURCES;

module.exports = model;
