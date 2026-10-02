const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");
const courseRefPlugin = require("#modules/4.05-residency/_services/courseRefPlugin");

const ResidencyTestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    scienceTitle: { type: String, default: null },
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
    maxScore: { type: Number, default: 100, min: 1, max: 100 },
    questionCount: { type: Number, default: null },
    desc: { type: String, default: null },

    fileUrl: { type: String, required: true },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    format: { type: String, default: null },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencyTestSchema.plugin(mongoosePaginate);
ResidencyTestSchema.plugin(aggregatePaginate);
ResidencyTestSchema.plugin(softDeletePlugin);
ResidencyTestSchema.plugin(academicYearRefPlugin);
ResidencyTestSchema.plugin(courseRefPlugin);

module.exports = mongoose.model("residencyTest", ResidencyTestSchema);
