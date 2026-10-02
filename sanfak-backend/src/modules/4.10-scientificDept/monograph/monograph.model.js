const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const MONOGRAPH_FILE_SLOTS = [
  "referral",
  "council",
  "file",
  "passport",
  "titul",
  "external",
  "internal",
  "antiplagiat",
  "ziyonet",
];

const MONOGRAPH_STATUSES = ["new", "pending", "approved", "rejected"];

const MONOGRAPH_REJECTER_ROLES = [
  "ilmiy_bolim",
  "ilmiy_kengash_kotibi",
  "prorektor",
  "ssv",
];

const MonographSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },

    title: { type: String, trim: true, default: "" },
    ssvNumber: { type: String, trim: true, default: "" },
    ssvDate: { type: String, trim: true, default: "" },
    isbn: { type: String, trim: true, default: "" },
    publisher: { type: String, trim: true, default: "" },
    isbnFileUrl: { type: String, default: "" },

    files: {
      referral: { type: String, default: "" },
      council: { type: String, default: "" },
      file: { type: String, default: "" },
      passport: { type: String, default: "" },
      titul: { type: String, default: "" },
      external: { type: String, default: "" },
      internal: { type: String, default: "" },
      antiplagiat: { type: String, default: "" },
      ziyonet: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: MONOGRAPH_STATUSES,
      default: "new",
    },

    ilmiyApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    ilmiyApprovedAt: { type: Date },

    kotibSignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    kotibSignedAt: { type: Date },
    kotibEriSerial: { type: String },

    prorektorSignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    prorektorSignedAt: { type: Date },
    prorektorEriSerial: { type: String },

    ssvSentBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    ssvSentAt: { type: Date },

    ssvReceivedAt: { type: Date },
    ssvResponseFileUrl: { type: String, default: "" },

    teacherConfirmedAt: { type: Date },

    dataApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    dataApprovedAt: { type: Date },
    dataRejectionReason: { type: String, default: "" },

    rejectionReason: { type: String },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    rejectedByRole: { type: String, enum: MONOGRAPH_REJECTER_ROLES },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

MonographSchema.plugin(mongoosePaginate);
MonographSchema.plugin(aggregatePaginate);

const model = mongoose.model("monograph", MonographSchema);
model.MONOGRAPH_FILE_SLOTS = MONOGRAPH_FILE_SLOTS;
model.MONOGRAPH_STATUSES = MONOGRAPH_STATUSES;

module.exports = model;
