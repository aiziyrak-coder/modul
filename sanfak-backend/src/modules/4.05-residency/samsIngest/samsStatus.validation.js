"use strict";

const Joi = require("joi");
const { DAY_RE, DBNAME_RE, isDayKey, daysInclusive } = require("./samsContract");
const { MAX_RANGE_DAYS } = require("./samsMonitorConfig");

const MAX_LIMIT = 200;

const day = Joi.string()
  .pattern(DAY_RE)
  .custom((v, helpers) => (isDayKey(v) ? v : helpers.error("any.invalid")))
  .messages({ "any.invalid": "{{#label}} mavjud kalendar kuni emas" });

const dbname = Joi.string().pattern(DBNAME_RE);

function rangeRule(value, helpers) {
  const { from, to } = value;
  if (!from || !to) return value;
  if (from > to) return helpers.error("range.order");
  if (daysInclusive(from, to) > MAX_RANGE_DAYS) return helpers.error("range.span");
  return value;
}

const RANGE_MESSAGES = {
  "range.order": "`from` `to` dan keyin bo'lmasligi kerak",
  "range.span": `Oraliq ${MAX_RANGE_DAYS} kundan oshmasligi kerak`,
};

const overviewQuery = Joi.object({});

const daysQuery = Joi.object({ from: day, to: day, dbname })
  .custom(rangeRule)
  .messages(RANGE_MESSAGES);

const warningsQuery = Joi.object({ day });

const clinicDayParams = Joi.object({ dbname: dbname.required(), day: day.required() });

const pageQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(50),
});

const residentParams = Joi.object({ resident: Joi.string().hex().length(24).required() });

const baselineQuery = Joi.object({ to: day });

module.exports = {
  MAX_LIMIT,
  overviewQuery,
  daysQuery,
  warningsQuery,
  clinicDayParams,
  pageQuery,
  residentParams,
  baselineQuery,
};
