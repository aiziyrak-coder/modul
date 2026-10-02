"use strict";
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const StudentAttendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "student",
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      default: "present",
    },
    note: { type: String, default: null },
  },
  { _id: false },
);

const AttendanceSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      required: true,
    },
    science: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "science",
      default: null,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },

    date: {
      type: Date,
      required: true,
    },
    lessonType: {
      type: String,
      enum: ["lecture", "seminar", "laboratory", "practical", "independent"],
      default: "lecture",
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
    },
    semester:     { type: Number, default: null },

    attendances: {
      type: [StudentAttendanceSchema],
      default: [],
    },

    stats: {
      total:   { type: Number, default: 0 },
      present: { type: Number, default: 0 },
      absent:  { type: Number, default: 0 },
      late:    { type: Number, default: 0 },
      excused: { type: Number, default: 0 },
    },

    note:   { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AttendanceSchema.index({ group: 1, date: -1 });
AttendanceSchema.index({ group: 1, science: 1, date: -1 });
AttendanceSchema.index({ teacher: 1, date: -1 });

AttendanceSchema.pre("save", function (next) {
  if (this.attendances && this.attendances.length) {
    const s = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
    for (const a of this.attendances) {
      s.total++;
      s[a.status] = (s[a.status] || 0) + 1;
    }
    this.stats = s;
  }
  next();
});

AttendanceSchema.plugin(mongoosePaginate);
AttendanceSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("studentAttendance", AttendanceSchema);
