const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");
const educationFormRefPlugin = require("#modules/4.05-residency/_services/educationFormRefPlugin");

const PROGRAMS = ["magistratura", "ordinatura"];

const CurriculumFileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: null },
    size: { type: Number, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ResidencyCurriculumSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencySpecialty",
      default: null,
      index: true,
    },
    specialtyTitle: { type: String, default: null },
    specialtyCode: { type: String, default: null },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    educationForm: { type: String, default: "kunduzgi" },
    educationFormRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "educationForm",
      default: null,
      index: true,
    },
    studyPeriod: { type: Number, default: 2 },
    approvedYear: { type: Number, default: null },
    academicYear: { type: String, default: null, index: true },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    processFile: { type: CurriculumFileSchema, default: null },
    planFile: { type: CurriculumFileSchema, default: null },
    note: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencyCurriculumSchema.plugin(mongoosePaginate);
ResidencyCurriculumSchema.plugin(softDeletePlugin);

ResidencyCurriculumSchema.plugin(academicYearRefPlugin);

ResidencyCurriculumSchema.plugin(educationFormRefPlugin);

const ResidencyCurriculumModel = mongoose.model(
  "residencyCurriculum",
  ResidencyCurriculumSchema,
);

module.exports = ResidencyCurriculumModel;
module.exports.PROGRAMS = PROGRAMS;
