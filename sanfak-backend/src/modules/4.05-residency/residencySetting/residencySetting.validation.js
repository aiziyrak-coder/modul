"use strict";

const Joi = require("joi");
const {
  TIME_RE,
  toMinutes,
  thresholdExceedsWindow,
  ABSENCE_WINDOW_FIT_MESSAGE,
} = require("./residencySetting.model");

const time = (label) =>
  Joi.string()
    .pattern(TIME_RE)
    .messages({
      "string.pattern.base": `${label} "SS:DD" ko'rinishida bo'lishi kerak (masalan: 09:00)`,
    });

const orderedWindow = (value, helpers) => {
  const from = toMinutes(value.workDayFrom);
  const to = toMinutes(value.workDayTo);
  if (from !== null && to !== null && from >= to) {
    return helpers.message(
      "Ish kuni boshlanishi tugashidan oldin bo'lishi kerak",
    );
  }
  return value;
};

const thresholdFitsWindow = (value, helpers) =>
  thresholdExceedsWindow(value.absenceStreakDays, value.absenceWindowDays)
    ? helpers.message(ABSENCE_WINDOW_FIT_MESSAGE)
    : value;

const updateSettingsSchema = Joi.object({
  workDayFrom: time("Ish kuni boshlanishi").optional(),
  workDayTo: time("Ish kuni tugashi").optional(),
  absenceStreakDays: Joi.number().integer().min(1).max(30).optional().messages({
    "number.min": "Ostona kamida 1 kun bo'lishi kerak",
    "number.max": "Ostona 30 kundan oshmasligi kerak",
  }),
  absenceWindowDays: Joi.number().integer().min(1).max(30).optional().messages({
    "number.min": "Oyna kamida 1 kun bo'lishi kerak",
    "number.max": "Oyna 30 kundan oshmasligi kerak",
  }),
})
  .min(1)
  .custom(orderedWindow, "ish kuni oralig'i")
  .custom(thresholdFitsWindow, "ostona oynaga sig'ishi");

module.exports = { updateSettingsSchema };
