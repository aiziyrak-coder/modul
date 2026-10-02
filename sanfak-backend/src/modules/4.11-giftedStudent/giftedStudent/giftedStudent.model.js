const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("../_services/academicYearRefPlugin");
const courseRefPlugin = require("../_services/courseRefPlugin");
const advisorRefPlugin = require("../_services/advisorRefPlugin");

const GiftedStudentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },

    fullName: { type: String, required: true },
    passportSeria: { type: String, default: null },
    passportNumber: { type: String, default: null },
    jshshir: { type: String, default: null },
    faculty: { type: String, default: null },
    direction: { type: String, default: null },
    course: { type: Number, default: null },
    group: { type: String, default: null },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "faculty", default: null },
    directionId: { type: mongoose.Schema.Types.ObjectId, ref: "direction", default: null },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "group", default: null },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
      index: true,
    },
    academicYear: { type: String, default: null },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    advisorId: { type: String, default: null, index: true },
    advisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
      index: true,
    },
    advisorName: { type: String, default: null },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    workplace: { type: String, default: null },

    totalScore: { type: Number, default: 0 },

    scoresByYear: { type: Map, of: Number, default: () => ({}) },

    rank: { type: Number },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

GiftedStudentSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: "objectId" }, deletedAt: null },
  },
);

GiftedStudentSchema.index(
  { passportSeria: 1, passportNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      passportSeria: { $type: "string" },
      passportNumber: { $type: "string" },
      deletedAt: null,
    },
  },
);
GiftedStudentSchema.index(
  { jshshir: 1 },
  {
    unique: true,
    partialFilterExpression: { jshshir: { $type: "string" }, deletedAt: null },
  },
);

GiftedStudentSchema.plugin(mongoosePaginate);
GiftedStudentSchema.plugin(aggregatePaginate);
GiftedStudentSchema.plugin(softDeletePlugin);
GiftedStudentSchema.plugin(academicYearRefPlugin);
GiftedStudentSchema.plugin(courseRefPlugin);
GiftedStudentSchema.plugin(advisorRefPlugin);

module.exports = mongoose.model("giftedStudent", GiftedStudentSchema);
