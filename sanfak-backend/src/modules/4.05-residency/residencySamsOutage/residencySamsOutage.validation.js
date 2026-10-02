"use strict";

const Joi = require("joi");
const {
  DAY_RE,
  DBNAME_RE,
  isDayKey,
} = require("#modules/4.05-residency/samsIngest/samsContract");

const day = Joi.string()
  .pattern(DAY_RE)
  .custom((v, helpers) => (isDayKey(v) ? v : helpers.error("any.invalid")))
  .messages({ "any.invalid": "{{#label}} mavjud kalendar kuni emas" });

const reason = Joi.string().trim().min(3).max(500).required().messages({
  "any.required": "Sabab ko'rsatilishi shart",
  "string.min": "Sabab juda qisqa",
});

const OUTAGE_STATUSES = ["active", "cancelled", "all"];

const createSchema = Joi.object({
  from: day.required(),
  to: day.required(),
  dbname: Joi.string().pattern(DBNAME_RE).allow(null).default(null),
  reason,
});

const cancelSchema = Joi.object({ reason });

const idSchema = Joi.object({ id: Joi.string().hex().length(24).required() });

const paginateQuery = Joi.object({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(100).required(),
  status: Joi.string().valid(...OUTAGE_STATUSES).default("active"),
  from: day,
  to: day,
});

module.exports = { createSchema, cancelSchema, idSchema, paginateQuery, OUTAGE_STATUSES };
