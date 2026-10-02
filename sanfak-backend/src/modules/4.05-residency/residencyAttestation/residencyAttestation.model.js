const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");
const courseRefPlugin = require("#modules/4.05-residency/_services/courseRefPlugin");

const ResidencyAttestationSchema = new mongoose.Schema(
  {
    scienceTitle: { type: String, required: true },
    science: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "science",
      default: null,
    },
    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencySpecialty",
      default: null,
    },
    specialtyTitle: { type: String, default: null },
    program: {
      type: String,
      enum: ["magistratura", "ordinatura"],
      default: null,
    },
    courseNumber: { type: Number, default: null },
    courseRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
      index: true,
    },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "group", default: null },
    groupTitle: { type: String, default: null },
    academicYear: { type: String, default: null },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    date: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencyAttestationSchema.plugin(mongoosePaginate);
ResidencyAttestationSchema.plugin(aggregatePaginate);
ResidencyAttestationSchema.plugin(softDeletePlugin);

ResidencyAttestationSchema.plugin(academicYearRefPlugin);

ResidencyAttestationSchema.plugin(courseRefPlugin);

module.exports = mongoose.model(
  "residencyAttestation",
  ResidencyAttestationSchema,
);
