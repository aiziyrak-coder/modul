"use strict";
const mongoose = require("mongoose");
const mongoosePaginate      = require("mongoose-paginate-v2");
const aggregatePaginate     = require("mongoose-aggregate-paginate-v2");

const EntrySchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "student",
      required: true,
    },
    attendance: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      default: "present",
    },
    grade: { type: Number, min: 0, max: 100, default: null },
    note:  { type: String, default: null },
  },
  { _id: false }
);

const LessonSchema = new mongoose.Schema(
  {
    date:    { type: Date,   required: true },
    topic:   { type: String, default: null },
    lessonType: {
      type: String,
      enum: ["lecture", "seminar", "laboratory", "practical", "independent"],
      default: "lecture",
    },
    hours:   { type: Number, default: 2 },
    entries: [EntrySchema],
  },
  { _id: true }
);

const SummarySchema = new mongoose.Schema(
  {
    student:        { type: mongoose.Schema.Types.ObjectId, ref: "student", required: true },
    attendedHours:  { type: Number, default: 0 },
    missedHours:    { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 0 },
    midterm:        { type: Number, default: null },
    final:          { type: Number, default: null },
    overall:        { type: Number, default: null },
    letterGrade:    { type: String, default: null },
    passed:         { type: Boolean, default: null },
  },
  { _id: false }
);

const GradebookSchema = new mongoose.Schema(
  {
    group:        { type: mongoose.Schema.Types.ObjectId, ref: "group",    required: true },
    science:      { type: mongoose.Schema.Types.ObjectId, ref: "science",  required: true },
    teacher:      { type: mongoose.Schema.Types.ObjectId, ref: "user",     required: true },
    faculty:      { type: mongoose.Schema.Types.ObjectId, ref: "faculty",  default: null },
    department:   { type: mongoose.Schema.Types.ObjectId, ref: "department", default: null },

    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
    },
    semester:     { type: Number, min: 1, max: 16, required: true },
    lessonType: {
      type: String,
      enum: ["lecture", "seminar", "laboratory", "practical"],
      default: "lecture",
    },
    totalHours:   { type: Number, default: 0 },

    lessons:  [LessonSchema],
    summary:  [SummarySchema],

    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },

    note:       { type: String, default: null },
    closedAt:   { type: Date,   default: null },
    closedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true }
);

GradebookSchema.index({ group: 1, science: 1, semester: 1, academicYear: 1 }, { unique: true });
GradebookSchema.index({ teacher: 1, academicYear: 1, semester: 1 });
GradebookSchema.index({ faculty: 1, academicYear: 1 });
GradebookSchema.index({ status: 1 });

GradebookSchema.plugin(mongoosePaginate);
GradebookSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("gradebook", GradebookSchema);
