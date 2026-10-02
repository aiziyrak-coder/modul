const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const DAILY_LOG_STATUSES = ["kutilmoqda", "tasdiqlangan", "qaytarilgan"];

const SKILL_COUNT_MIN = 0;
const SKILL_COUNT_MAX = 1000;

const SkillEntrySchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencySkill",
      default: null,
    },
    skill: { type: String },
    count: { type: Number, default: 1, min: SKILL_COUNT_MIN, max: SKILL_COUNT_MAX },
  },
  { _id: false },
);

const CountedItemSchema = new mongoose.Schema(
  {
    title: { type: String },
    count: { type: Number },
  },
  { _id: false },
);

const DailyLogSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      required: true,
      index: true,
    },
    date: { type: Date, required: true },

    workType: { type: String, default: null },
    semester: { type: String, default: null },
    clinicalWork: { type: String, default: null },
    skills: { type: [SkillEntrySchema], default: [] },

    treatments: { type: [CountedItemSchema], default: [] },
    practicalSkills: { type: [CountedItemSchema], default: [] },

    fileUrl: { type: String, default: null },

    status: {
      type: String,
      enum: DAILY_LOG_STATUSES,
      default: "kutilmoqda",
      index: true,
    },
    supervisorApproved: { type: Boolean, default: false },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    supervisorComment: { type: String, default: null },
    comment: { type: String, default: null },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

DailyLogSchema.plugin(mongoosePaginate);
DailyLogSchema.plugin(aggregatePaginate);
DailyLogSchema.plugin(softDeletePlugin);

const DailyLogModel = mongoose.model("dailyLog", DailyLogSchema);

module.exports = DailyLogModel;
module.exports.DAILY_LOG_STATUSES = DAILY_LOG_STATUSES;
module.exports.SKILL_COUNT_MIN = SKILL_COUNT_MIN;
module.exports.SKILL_COUNT_MAX = SKILL_COUNT_MAX;
