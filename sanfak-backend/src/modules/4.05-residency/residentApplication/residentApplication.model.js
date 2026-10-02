const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");

const RESIDENT_APPLICATION_TYPES = [
  "academic_leave",
  "attestation_postpone",
  "conference",
  "reference",
  "schedule_change",
  "other",
];

const RESIDENT_APPLICATION_STATUSES = [
  "yangi",
  "korib_chiqilmoqda",
  "tasdiqlangan",
  "rad_etilgan",
];

const ResidentApplicationSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      required: true,
      index: true,
    },
    type: { type: String, enum: RESIDENT_APPLICATION_TYPES, required: true },
    reason: { type: String, default: null },
    academicYear: { type: String, default: null },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    fileUrl: { type: String, default: null },

    status: {
      type: String,
      enum: RESIDENT_APPLICATION_STATUSES,
      default: "yangi",
      index: true,
    },
    comment: { type: String, default: null },

    fromDate: { type: Date, default: null },
    toDate: { type: Date, default: null },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidentApplicationSchema.plugin(mongoosePaginate);
ResidentApplicationSchema.plugin(aggregatePaginate);
ResidentApplicationSchema.plugin(softDeletePlugin);

ResidentApplicationSchema.plugin(academicYearRefPlugin);

const ResidentApplicationModel = mongoose.model(
  "residentApplication",
  ResidentApplicationSchema,
);

module.exports = ResidentApplicationModel;
module.exports.RESIDENT_APPLICATION_TYPES = RESIDENT_APPLICATION_TYPES;
module.exports.RESIDENT_APPLICATION_STATUSES = RESIDENT_APPLICATION_STATUSES;
