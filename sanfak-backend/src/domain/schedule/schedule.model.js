const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const ScheduleSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 1, max: 6 },
    timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "timeSlot" },
    science: { type: mongoose.Schema.Types.ObjectId, ref: "science" },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "group" },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "room" },
    lessonType: {
      type: String,
      enum: ["maruza", "amaliy", "laboratoriya", "seminar", "klinik_amaliyot"],
    },
    semester: { type: Number },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
    },
    weekType: {
      type: String,
      enum: ["odd", "even", "both"],
      default: "both",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ScheduleSchema.plugin(mongoosePaginate);
ScheduleSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("schedule", ScheduleSchema);
