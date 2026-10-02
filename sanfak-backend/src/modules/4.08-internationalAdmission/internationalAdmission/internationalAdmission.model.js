const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const APPLICANT_STATUSES = ["new", "approved", "rejected"];

const DOCUMENT_SLOTS = ["passport", "diploma", "certificate"];

const DocumentSlotSchema = new mongoose.Schema(
  {
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    uploadedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

const ApplicantSchema = new mongoose.Schema(
  {
    applicationNumber: { type: String, trim: true, unique: true, sparse: true },

    fullName: { type: String, required: true, trim: true },
    birthDate: { type: Date },
    country: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    parentPhone: { type: String, trim: true },
    passportNumber: { type: String, trim: true },
    passportExpiry: { type: Date },
    email: { type: String, trim: true },
    photoUrl: { type: String, default: "" },

    direction: { type: mongoose.Schema.Types.ObjectId, ref: "admissionDirection" },
    educationForm: { type: mongoose.Schema.Types.ObjectId, ref: "admissionEducationForm" },
    educationLanguage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "admissionEducationLanguage",
    },
    season: { type: mongoose.Schema.Types.ObjectId, ref: "admissionSeason" },
    academicYear: { type: String, trim: true },

    documents: {
      passport: { type: DocumentSlotSchema, default: undefined },
      diploma: { type: DocumentSlotSchema, default: undefined },
      certificate: { type: DocumentSlotSchema, default: undefined },
    },
    offerAccepted: { type: Boolean, default: false },

    status: { type: String, enum: APPLICANT_STATUSES, default: "new" },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    reviewedAt: { type: Date },

    notes: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ApplicantSchema.plugin(mongoosePaginate);
ApplicantSchema.plugin(aggregatePaginate);

const model = mongoose.model("applicant", ApplicantSchema);
model.APPLICANT_STATUSES = APPLICANT_STATUSES;
model.DOCUMENT_SLOTS = DOCUMENT_SLOTS;

module.exports = model;
