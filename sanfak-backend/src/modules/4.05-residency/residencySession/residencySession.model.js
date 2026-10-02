const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const {
  RESIDENCY_LESSON_TYPES,
} = require("#modules/4.05-residency/attendance/attendance.model");
const { DAY_RE } = require("#modules/4.05-residency/_services/sessionDay");

const SESSION_ANNOUNCED = "announced";
const SESSION_CANCELLED = "cancelled";
const SESSION_STATUSES = [SESSION_ANNOUNCED, SESSION_CANCELLED];

const ROSTER_SCOPES = ["group", "supervised"];

const SESSION_HOURS_MIN = 1;
const SESSION_HOURS_MAX = 8;

const ANNOUNCED_INDEX_NAME = "session_announced_unique";

const ref = (model) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required: true,
  immutable: true,
});

const ResidencySessionSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, immutable: true, match: DAY_RE },
    group: ref("group"),
    groupTitle: { type: String, default: null },
    science: ref("science"),
    scienceTitle: { type: String, default: null },
    lessonType: { type: String, enum: RESIDENCY_LESSON_TYPES, required: true, immutable: true },
    hours: {
      type: Number,
      required: true,
      immutable: true,
      min: SESSION_HOURS_MIN,
      max: SESSION_HOURS_MAX,
      validate: { validator: Number.isInteger, message: "Soat butun son bo'lishi kerak" },
    },
    announcedBy: ref("user"),
    rosterScope: { type: String, enum: ROSTER_SCOPES, required: true, immutable: true },
    status: { type: String, enum: SESSION_STATUSES, required: true },

    fannedOutAt: { type: Date, default: null },
    framedCount: { type: Number, default: 0 },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    cancelReason: { type: String, default: null },

    rosterFrozenAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

ResidencySessionSchema.plugin(mongoosePaginate);

ResidencySessionSchema.index(
  { announcedBy: 1, group: 1, day: 1, science: 1, lessonType: 1 },
  {
    unique: true,
    partialFilterExpression: { status: SESSION_ANNOUNCED },
    name: ANNOUNCED_INDEX_NAME,
  },
);
ResidencySessionSchema.index({ day: -1 }, { name: "day_desc" });
ResidencySessionSchema.index({ group: 1, day: -1 }, { name: "group_day" });
ResidencySessionSchema.index({ announcedBy: 1, day: -1 }, { name: "announcedBy_day" });

const ResidencySessionModel = mongoose.model("residencySession", ResidencySessionSchema);

module.exports = ResidencySessionModel;
module.exports.SESSION_STATUSES = SESSION_STATUSES;
module.exports.SESSION_ANNOUNCED = SESSION_ANNOUNCED;
module.exports.SESSION_CANCELLED = SESSION_CANCELLED;
module.exports.ROSTER_SCOPES = ROSTER_SCOPES;
module.exports.SESSION_HOURS_MIN = SESSION_HOURS_MIN;
module.exports.SESSION_HOURS_MAX = SESSION_HOURS_MAX;
module.exports.ANNOUNCED_INDEX_NAME = ANNOUNCED_INDEX_NAME;
