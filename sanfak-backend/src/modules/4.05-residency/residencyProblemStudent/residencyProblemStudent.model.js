const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");
const courseRefPlugin = require("#modules/4.05-residency/_services/courseRefPlugin");

const PROGRAMS = ["magistratura", "ordinatura"];

const ResidencyProblemStudentSchema = new mongoose.Schema(
  {
    academicYear: { type: String, default: null, index: true },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    departmentTitle: { type: String, default: null },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencySpecialty",
      default: null,
    },
    specialtyTitle: { type: String, default: null },
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      default: null,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    courseNumber: { type: Number, default: null },
    courseRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
      index: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      default: null,
    },
    groupTitle: { type: String, default: null },
    date: { type: Date, default: Date.now },
    content: { type: String, required: true },
    conclusion: { type: String, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencyProblemStudentSchema.plugin(mongoosePaginate);
ResidencyProblemStudentSchema.plugin(softDeletePlugin);

ResidencyProblemStudentSchema.plugin(academicYearRefPlugin);

ResidencyProblemStudentSchema.plugin(courseRefPlugin);

const ResidencyProblemStudentModel = mongoose.model(
  "residencyProblemStudent",
  ResidencyProblemStudentSchema,
);

module.exports = ResidencyProblemStudentModel;
module.exports.PROGRAMS = PROGRAMS;
