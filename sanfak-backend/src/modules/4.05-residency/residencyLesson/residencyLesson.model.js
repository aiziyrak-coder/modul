const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");
const courseRefPlugin = require("#modules/4.05-residency/_services/courseRefPlugin");

const LessonGroupSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      required: true,
    },
    title: { type: String, default: null },
  },
  { _id: false },
);

const ResidencyLessonSchema = new mongoose.Schema(
  {
    academicYear: { type: String, default: null, index: true },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    courseNumber: { type: Number, default: null, index: true },
    courseRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
      index: true,
    },
    science: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "science",
      required: true,
      index: true,
    },
    scienceTitle: { type: String, default: null },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    departmentTitle: { type: String, default: null },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
      index: true,
    },
    teacherName: { type: String, default: null },
    groups: { type: [LessonGroupSchema], default: [] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencyLessonSchema.index({ "groups.group": 1 });
ResidencyLessonSchema.index({ startDate: 1, endDate: 1 });

ResidencyLessonSchema.plugin(mongoosePaginate);
ResidencyLessonSchema.plugin(softDeletePlugin);

ResidencyLessonSchema.plugin(academicYearRefPlugin);

ResidencyLessonSchema.plugin(courseRefPlugin);

const ResidencyLessonModel = mongoose.model("residencyLesson", ResidencyLessonSchema);

module.exports = ResidencyLessonModel;
