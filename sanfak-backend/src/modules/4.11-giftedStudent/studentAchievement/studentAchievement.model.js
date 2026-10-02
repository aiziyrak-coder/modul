const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const { ReviewHistorySchema } = require("../_services/reviewHistory");
const { currentAcademicYear } = require("../_services/academicYearWindow");

const StudentAchievementSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "giftedStudent",
      required: true,
    },
    documentType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "documentType",
      required: true,
    },
    title: { type: String },
    desc: { type: String, default: null },
    fileUrl: { type: String },
    fileName: { type: String },
    link: { type: String },
    academicYear: {
      type: String,
      default: () => currentAcademicYear(),
      index: true,
    },
    score: { type: Number, default: 0 },
    scoreCriteria: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "evaluationCriteria",
      default: null,
    },
    scoreCategoryId: { type: String, default: null },
    scoreLabel: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewNote: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    reviewedAt: { type: Date },
    reviewHistory: { type: [ReviewHistorySchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

StudentAchievementSchema.plugin(mongoosePaginate);
StudentAchievementSchema.plugin(aggregatePaginate);
StudentAchievementSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("studentAchievement", StudentAchievementSchema);
