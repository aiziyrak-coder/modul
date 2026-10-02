"use strict";

const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

const MAX_COURSE = 7;
const MAX_STREAMS = 50;
const MAX_NOTE = 500;
const MAX_ROWS = 200;
const MAX_GROUPS_PER_STREAM = 100;

const StreamSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, min: 1, max: MAX_STREAMS },
    groups: { type: [{ type: ObjectId, ref: "group" }], default: [] },
  },
  { _id: false },
);

const RowSchema = new mongoose.Schema({
  direction: { type: ObjectId, ref: "direction", required: true },
  course: { type: ObjectId, ref: "course", required: true },
  courseNum: { type: Number, required: true, min: 1, max: MAX_COURSE },
  streams: { type: [StreamSchema], default: [] },
  note: { type: String, default: null, maxlength: MAX_NOTE },
});

const DepartmentContingentSchema = new mongoose.Schema(
  {
    department: { type: ObjectId, ref: "department", required: true, index: true },
    academicYear: { type: ObjectId, ref: "academicYear", required: true },
    rows: { type: [RowSchema], default: [] },
    active: { type: Boolean, default: true },
    lastEditedBy: { type: ObjectId, ref: "user", default: null },
  },
  { timestamps: true },
);

DepartmentContingentSchema.index(
  { department: 1, academicYear: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
DepartmentContingentSchema.index({ academicYear: 1, active: 1 });

module.exports = mongoose.model("departmentContingent", DepartmentContingentSchema);
module.exports.MAX_COURSE = MAX_COURSE;
module.exports.MAX_STREAMS = MAX_STREAMS;
module.exports.MAX_NOTE = MAX_NOTE;
module.exports.MAX_ROWS = MAX_ROWS;
module.exports.MAX_GROUPS_PER_STREAM = MAX_GROUPS_PER_STREAM;
