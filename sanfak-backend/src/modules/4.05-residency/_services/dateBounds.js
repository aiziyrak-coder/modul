const Joi = require("joi");

const MIN_DATE = new Date("2000-01-01T00:00:00.000Z");

const MAX_PLAN_YEARS_AHEAD = 10;

const endOfUtcDay = () => {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
};
const yearsAhead = (n) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d;
};

const ceilingAtValidation = (limitFn) => (value, helpers) =>
  value > limitFn() ? helpers.error("date.max") : value;

const attendanceDate = () =>
  Joi.date()
    .min(MIN_DATE)
    .custom(ceilingAtValidation(endOfUtcDay))
    .messages({
      "date.max": "Davomat kelajakdagi sanaga qo'yib bo'lmaydi",
      "date.min": "Sana juda eski — tekshiring",
    });

const planDueDate = () =>
  Joi.date()
    .min(MIN_DATE)
    .custom(ceilingAtValidation(() => yearsAhead(MAX_PLAN_YEARS_AHEAD)))
    .messages({
      "date.max": "Muddat juda uzoq kelajakda — yilni tekshiring",
      "date.min": "Sana juda eski — yilni tekshiring",
    });

const proofWorkDate = () =>
  Joi.date()
    .min(MIN_DATE)
    .custom(ceilingAtValidation(endOfUtcDay))
    .messages({
      "date.max": "Ish sanasi kelajakda bo'la olmaydi",
      "date.min": "Sana juda eski — tekshiring",
    });

module.exports = {
  MIN_DATE,
  MAX_PLAN_YEARS_AHEAD,
  endOfUtcDay,
  attendanceDate,
  planDueDate,
  proofWorkDate,
};
