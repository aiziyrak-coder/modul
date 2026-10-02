const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("../_services/academicYearRefPlugin");
const { allowedCoursesRefPlugin } = require("../_services/courseRefPlugin");

const ScholarshipCriterionSchema = new mongoose.Schema(
  {
    criteria: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "evaluationCriteria",
      required: true,
    },
    categoryIds: [{ type: String }],
    pointOverrides: [
      {
        categoryId: { type: String },
        points: { type: Number },
      },
    ],
    typePointOverride: { type: Number },
  },
  { _id: false },
);

const ScholarshipSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ["nomdor", "rektor"], required: true },
    minScore: { type: Number, default: 0 },
    amount: { type: String },
    deadline: { type: Date },
    academicYear: { type: String },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    allowedCourses: [{ type: String }],
    allowedCourseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "course" }],
    active: { type: Boolean, default: true },
    judges: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    criteria: [ScholarshipCriterionSchema],
  },
  { timestamps: true, versionKey: false },
);

ScholarshipSchema.plugin(mongoosePaginate);
ScholarshipSchema.plugin(aggregatePaginate);
ScholarshipSchema.plugin(softDeletePlugin);
ScholarshipSchema.plugin(academicYearRefPlugin);
ScholarshipSchema.plugin(allowedCoursesRefPlugin);

module.exports = mongoose.model("scholarship", ScholarshipSchema);
