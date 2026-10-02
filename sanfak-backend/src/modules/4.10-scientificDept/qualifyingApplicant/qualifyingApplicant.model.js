const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const APPLICANT_STATUSES = ["new", "approved", "rejected", "passed", "failed"];
const RESEARCHER_TYPES = ["mustaqil", "tayanch"];
const APPLICANT_DOC_SLOTS = [
  "referral",
  "application",
  "passport",
  "diploma",
  "objektivka",
  "topic",
  "order",
];
const LEGACY_DOC_SLOTS = ["personal"];
const APPLICANT_SOURCES = ["internal", "public"];

const QualifyingApplicantSchema = new mongoose.Schema(
  {
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    source: { type: String, enum: APPLICANT_SOURCES, default: "internal" },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "department", default: null },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "faculty", default: null },

    name: { type: String, trim: true, default: "" },
    researcherType: { type: String, enum: RESEARCHER_TYPES },
    course: { type: Number, default: null },
    specialization: { type: String, required: true, trim: true },
    university: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },

    documents: {
      referral: { type: String, default: "" },
      application: { type: String, default: "" },
      passport: { type: String, default: "" },
      diploma: { type: String, default: "" },
      objektivka: { type: String, default: "" },
      topic: { type: String, default: "" },
      order: { type: String, default: "" },
      personal: { type: String, default: "" },
    },

    status: { type: String, enum: APPLICANT_STATUSES, default: "new" },
    examDate: { type: Date, default: null },
    certificateFileUrl: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    resultBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

QualifyingApplicantSchema.plugin(mongoosePaginate);

const model = mongoose.model("qualifyingApplicant", QualifyingApplicantSchema);
model.APPLICANT_STATUSES = APPLICANT_STATUSES;
model.RESEARCHER_TYPES = RESEARCHER_TYPES;
model.APPLICANT_DOC_SLOTS = APPLICANT_DOC_SLOTS;
model.LEGACY_DOC_SLOTS = LEGACY_DOC_SLOTS;
model.APPLICANT_SOURCES = APPLICANT_SOURCES;

module.exports = model;
