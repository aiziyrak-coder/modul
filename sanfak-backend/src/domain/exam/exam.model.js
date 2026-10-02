"use strict";
const mongoose = require("mongoose");
const mongoosePaginate  = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const ExamResultSchema = new mongoose.Schema(
  {
    student:    { type: mongoose.Schema.Types.ObjectId, ref: "student", required: true },
    grade:      { type: Number, min: 0, max: 100, default: null },
    letterGrade:{ type: String, enum: ["A", "B+", "B", "C+", "C", "D", "F", null], default: null },
    passed:     { type: Boolean, default: null },
    absent:     { type: Boolean, default: false },
    note:       { type: String, default: null },
    gradedAt:   { type: Date, default: null },
  },
  { _id: true }
);

const ExamSchema = new mongoose.Schema(
  {
    groups:   [{ type: mongoose.Schema.Types.ObjectId, ref: "group" }],
    science:   { type: mongoose.Schema.Types.ObjectId, ref: "science",    required: true },
    teacher:   { type: mongoose.Schema.Types.ObjectId, ref: "user",       required: true },
    faculty:   { type: mongoose.Schema.Types.ObjectId, ref: "faculty",    default: null },
    department:{ type: mongoose.Schema.Types.ObjectId, ref: "department", default: null },
    room:      { type: mongoose.Schema.Types.ObjectId, ref: "room",       default: null },

    examType: {
      type: String,
      enum: ["midterm", "final", "retake", "state", "defense"],
      required: true,
    },
    date:       { type: Date,   required: true },
    startTime:  { type: String, default: null },
    duration:   { type: Number, default: 120 },

    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
    },
    semester:     { type: Number, min: 1, max: 16, required: true },

    results: [ExamResultSchema],

    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "cancelled", "postponed"],
      default: "scheduled",
    },

    note:       { type: String, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true }
);

ExamSchema.index({ science: 1, academicYear: 1, semester: 1 });
ExamSchema.index({ groups: 1, academicYear: 1, semester: 1 });
ExamSchema.index({ teacher: 1, date: 1 });
ExamSchema.index({ date: 1, status: 1 });
ExamSchema.index({ faculty: 1, academicYear: 1 });

ExamSchema.plugin(mongoosePaginate);
ExamSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("exam", ExamSchema);
