const mongoose = require("mongoose");
const {
  RESIDENCY_LESSON_TYPES,
} = require("#modules/4.05-residency/attendance/attendance.model");
const { DAY_RE } = require("#modules/4.05-residency/_services/sessionDay");
const {
  SESSION_HOURS_MIN,
  SESSION_HOURS_MAX,
} = require("#modules/4.05-residency/residencySession/residencySession.model");
const { TIME_RE } = require("#modules/4.05-residency/residencySetting/residencySetting.model");
const { LESSON_SCORE_MAX } = require("#modules/4.05-residency/_services/lessonScore");

const FRAME_PENDING = "pending";
const FRAME_PRESENT = "present";
const FRAME_ABSENT = "absent";
const FRAME_UNMEASURED = "unmeasured";
const FRAME_VOID = "void";
const FRAME_OUTCOMES = [FRAME_PENDING, FRAME_PRESENT, FRAME_ABSENT, FRAME_UNMEASURED, FRAME_VOID];

const LIVE_FRAME = Object.freeze({ cancelledAt: null });

const SESSION_RESIDENT_INDEX = "session_resident_unique";
const LIVE_KEY_INDEX = "resident_lesson_live_unique";

const required = { required: true, immutable: true };
const objectRef = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, ...required });

const ResidencySessionRosterSchema = new mongoose.Schema(
  {
    session: objectRef("residencySession"),
    resident: objectRef("resident"),
    day: { type: String, match: DAY_RE, ...required },
    science: objectRef("science"),
    lessonType: { type: String, enum: RESIDENCY_LESSON_TYPES, ...required },
    hours: {
      type: Number,
      min: SESSION_HOURS_MIN,
      max: SESSION_HOURS_MAX,
      validate: { validator: Number.isInteger, message: "Soat butun son bo'lishi kerak" },
      ...required,
    },

    outcome: { type: String, enum: FRAME_OUTCOMES, required: true },
    outcomeReason: { type: String, default: null },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: "attendance", default: null },
    resolvedAt: { type: Date, default: null },

    cancelledAt: { type: Date, default: null },

    samsFirstIn: { type: String, default: null, match: TIME_RE },
    samsLastOut: { type: String, default: null, match: TIME_RE },
    lateMinutes: { type: Number, default: null, min: 1, max: 600 },
    devices: { type: [Number], default: [] },
    excuseApplication: { type: mongoose.Schema.Types.ObjectId, ref: "residentApplication", default: null },
    resolvedRev: { type: Number, default: null },
    resolverVersion: { type: Number, default: null },
    score: { type: Number, default: null, min: 0, max: LESSON_SCORE_MAX },
    scoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    scoredAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

ResidencySessionRosterSchema.index(
  { session: 1, resident: 1 },
  { unique: true, partialFilterExpression: { ...LIVE_FRAME }, name: SESSION_RESIDENT_INDEX },
);
ResidencySessionRosterSchema.index(
  { resident: 1, day: 1, science: 1, lessonType: 1 },
  { unique: true, partialFilterExpression: { ...LIVE_FRAME }, name: LIVE_KEY_INDEX },
);
ResidencySessionRosterSchema.index({ resident: 1, day: -1 }, { name: "resident_day" });

const ResidencySessionRosterModel = mongoose.model(
  "residencySessionRoster",
  ResidencySessionRosterSchema,
);

module.exports = ResidencySessionRosterModel;
module.exports.FRAME_OUTCOMES = FRAME_OUTCOMES;
module.exports.FRAME_PENDING = FRAME_PENDING;
module.exports.FRAME_PRESENT = FRAME_PRESENT;
module.exports.FRAME_ABSENT = FRAME_ABSENT;
module.exports.FRAME_UNMEASURED = FRAME_UNMEASURED;
module.exports.FRAME_VOID = FRAME_VOID;
module.exports.LIVE_FRAME = LIVE_FRAME;
module.exports.SESSION_RESIDENT_INDEX = SESSION_RESIDENT_INDEX;
module.exports.LIVE_KEY_INDEX = LIVE_KEY_INDEX;
