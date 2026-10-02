const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("../_services/academicYearRefPlugin");
const { ReviewHistorySchema } = require("../_services/reviewHistory");

const ScholarshipApplicationSchema = new mongoose.Schema(
  {
    giftedStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "giftedStudent",
      required: true,
    },
    scholarship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "scholarship",
    },
    type: {
      type: String,
      enum: ["rektor_stipendiyasi", "nomdor_stipendiya", "davlat_granti", "other"],
      required: true,
    },
    scholarshipName: { type: String },
    appliedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    motivation: { type: String },
    documents: [
      {
        title:   { type: String },
        fileUrl: { type: String },
      },
    ],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    reviewedAt: { type: Date },
    rejectReason: { type: String },
    reviewHistory: { type: [ReviewHistorySchema], default: [] },
    amount: { type: Number },
    period: { type: String },
    academicYear: { type: String },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    judgeScores: [
      {
        judge: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        scores: [
          {
            criteria: { type: mongoose.Schema.Types.ObjectId, ref: "evaluationCriteria" },
            categoryId: { type: String },
            value: { type: Number },
          },
        ],
        totalScore: { type: Number, default: 0 },
        submittedAt: { type: Date },
      },
    ],

    judgeScoreHistory: [
      {
        judge: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        scores: [
          {
            criteria: { type: mongoose.Schema.Types.ObjectId, ref: "evaluationCriteria" },
            categoryId: { type: String },
            value: { type: Number },
          },
        ],
        totalScore: { type: Number, default: 0 },
        submittedAt: { type: Date },
        supersededAt: { type: Date },
        supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
      },
    ],

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ScholarshipApplicationSchema.plugin(mongoosePaginate);
ScholarshipApplicationSchema.plugin(softDeletePlugin);
ScholarshipApplicationSchema.plugin(academicYearRefPlugin);

module.exports = mongoose.model("scholarshipApplication", ScholarshipApplicationSchema);
