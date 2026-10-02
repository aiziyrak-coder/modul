const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const CONTRACT_STATUSES = [
  "draft",
  "in_progress",
  "rektor_approved",
  "both_approved",
  "rejected",
];

const eriSignature = () => ({
  signed: { type: Boolean, default: false },
  signer: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  signedAt: { type: Date },
  certInfo: {
    serialNumber: { type: String },
    subject: { type: String },
    validFrom: { type: Date },
    validTo: { type: Date },
  },
  signature: { type: String },
});

const historyEntry = new mongoose.Schema(
  {
    at: { type: Date, default: () => new Date() },
    actor: { type: String },
    action: { type: String },
    reason: { type: String },
  },
  { _id: false },
);

const PracticeContractSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "medicalOrganization",
      required: true,
    },
    direction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "direction",
      required: true,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
    },
    course: { type: Number },
    group: { type: String },
    students: [
      { type: mongoose.Schema.Types.ObjectId, ref: "practiceStudent" },
    ],
    studentsCount: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    note: { type: String, default: null },

    status: {
      type: String,
      enum: CONTRACT_STATUSES,
      default: "draft",
    },

    rector: eriSignature(),
    orgHead: eriSignature(),

    rejectReason: { type: String, default: null },
    rejectedBy: {
      type: String,
      enum: ["rektor", "org_head", null],
      default: null,
    },

    history: [historyEntry],

    generatedText: { type: String, default: null },
    fileUrl: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

PracticeContractSchema.plugin(mongoosePaginate);
PracticeContractSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("practiceContract", PracticeContractSchema);
module.exports.CONTRACT_STATUSES = CONTRACT_STATUSES;
