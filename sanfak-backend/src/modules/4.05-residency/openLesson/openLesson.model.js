const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");

const OpenLessonSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      required: true,
      index: true,
    },
    residentName: { type: String, default: null },

    type: {
      type: String,
      enum: ["ochiq_dars", "dars_kuzatish"],
      required: true,
      index: true,
    },

    plan: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    planKind: {
      type: String,
      enum: ["activity", "dissertation"],
      default: null,
    },
    planTitle: { type: String, default: null },
    taskTitle: { type: String, default: null },

    date: { type: Date, required: true },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "room",
      default: null,
      index: true,
    },
    roomTitle: { type: String, default: null },
    topic: { type: String, default: null },
    attendees: {
      type: [
        new mongoose.Schema(
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "user",
              required: true,
            },
            name: { type: String, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    note: { type: String, default: null },
    academicYear: { type: String, default: null },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

OpenLessonSchema.index({ resident: 1, date: -1 });

OpenLessonSchema.plugin(mongoosePaginate);
OpenLessonSchema.plugin(aggregatePaginate);
OpenLessonSchema.plugin(softDeletePlugin);

OpenLessonSchema.plugin(academicYearRefPlugin);

const OPEN_LESSON_TYPES = ["ochiq_dars", "dars_kuzatish"];
const PLAN_KINDS = ["activity", "dissertation"];

module.exports = mongoose.model("residencyOpenLesson", OpenLessonSchema);
module.exports.OPEN_LESSON_TYPES = OPEN_LESSON_TYPES;
module.exports.PLAN_KINDS = PLAN_KINDS;
