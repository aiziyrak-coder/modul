"use strict";

const mongoose = require("mongoose");

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (hhmm) => {
  const m = TIME_RE.exec(String(hhmm ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const DEFAULT_WORK_DAY_FROM = "09:00";
const DEFAULT_WORK_DAY_TO = "14:00";

const DEFAULT_ABSENCE_STREAK_DAYS = 3;

const DEFAULT_ABSENCE_WINDOW_DAYS = 7;

const ABSENCE_WINDOW_FIT_MESSAGE =
  "Sababsiz kunlar soni oyna kunlaridan ko'p bo'lmasligi kerak";
const thresholdExceedsWindow = (n, w) =>
  Number.isFinite(n) && Number.isFinite(w) && n > w;

const workDayOrderError = (body, current) => {
  const from = toMinutes(body.workDayFrom ?? current.workDayFrom);
  const to = toMinutes(body.workDayTo ?? current.workDayTo);
  return from !== null && to !== null && from >= to
    ? "Ish kuni boshlanishi tugashidan oldin bo'lishi kerak"
    : null;
};
const absenceFitError = (body, current) => {
  if (body.absenceStreakDays === undefined && body.absenceWindowDays === undefined) return null;
  return thresholdExceedsWindow(
    body.absenceStreakDays ?? current.absenceStreakDays,
    body.absenceWindowDays ?? current.absenceWindowDays,
  )
    ? ABSENCE_WINDOW_FIT_MESSAGE
    : null;
};

const ResidencySettingSchema = new mongoose.Schema(
  {
    workDayFrom: {
      type: String,
      default: DEFAULT_WORK_DAY_FROM,
      match: TIME_RE,
    },
    workDayTo: {
      type: String,
      default: DEFAULT_WORK_DAY_TO,
      match: TIME_RE,
    },
    absenceStreakDays: {
      type: Number,
      default: DEFAULT_ABSENCE_STREAK_DAYS,
      min: 1,
      max: 30,
    },
    absenceWindowDays: {
      type: Number,
      default: DEFAULT_ABSENCE_WINDOW_DAYS,
      min: 1,
      max: 30,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true, versionKey: false },
);

const ResidencySettingModel = mongoose.model(
  "residencySetting",
  ResidencySettingSchema,
);

module.exports = ResidencySettingModel;
module.exports.TIME_RE = TIME_RE;
module.exports.toMinutes = toMinutes;
module.exports.DEFAULT_WORK_DAY_FROM = DEFAULT_WORK_DAY_FROM;
module.exports.DEFAULT_WORK_DAY_TO = DEFAULT_WORK_DAY_TO;
module.exports.DEFAULT_ABSENCE_STREAK_DAYS = DEFAULT_ABSENCE_STREAK_DAYS;
module.exports.DEFAULT_ABSENCE_WINDOW_DAYS = DEFAULT_ABSENCE_WINDOW_DAYS;
module.exports.ABSENCE_WINDOW_FIT_MESSAGE = ABSENCE_WINDOW_FIT_MESSAGE;
module.exports.thresholdExceedsWindow = thresholdExceedsWindow;
module.exports.workDayOrderError = workDayOrderError;
module.exports.absenceFitError = absenceFitError;
