const Joi = require("joi");
const {
  optionalString,
  optionalObjectId,
  optionalNumber,
} = require("#validators/common");
const {
  RESIDENCY_LESSON_TYPES,
} = require("#modules/4.05-residency/attendance/attendance.model");
const { DAY_RE, isCalendarDay } = require("#modules/4.05-residency/_services/sessionDay");
const {
  SESSION_STATUSES,
  SESSION_HOURS_MIN,
  SESSION_HOURS_MAX,
} = require("./residencySession.model");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");
const DAY_MESSAGE = "Sana YYYY-MM-DD ko'rinishida bo'lishi kerak";

const calendarDay = Joi.string()
  .custom((value, helpers) => (isCalendarDay(value) ? value : helpers.error("any.invalid")))
  .messages({ "any.invalid": DAY_MESSAGE, "string.base": DAY_MESSAGE });

const announceSchema = Joi.object({
  day: calendarDay.required(),
  group: objectId.required(),
  science: objectId.required(),
  lessonType: Joi.string().valid(...RESIDENCY_LESSON_TYPES).required(),
  hours: Joi.number().integer().min(SESSION_HOURS_MIN).max(SESSION_HOURS_MAX).required(),
  teacher: Joi.any().strip(),
  announcedBy: Joi.any().strip(),
});

const cancelSchema = Joi.object({
  reason: Joi.string().trim().min(2).max(500).required().messages({
    "any.required": "Bekor qilish sababi ko'rsatilishi shart",
    "string.min": "Sabab juda qisqa",
  }),
});

const idSchema = Joi.object({ id: objectId.required() });

const page = optionalNumber(Joi.number().integer().min(1).default(1));
const limit = optionalNumber(Joi.number().integer().min(1).max(100).default(20));
const dayFilter = optionalString(Joi.string().pattern(DAY_RE).messages({ "string.pattern.base": DAY_MESSAGE }));

const paginateQuery = Joi.object({
  page,
  limit,
  from: dayFilter,
  to: dayFilter,
  group: optionalObjectId(objectId),
  science: optionalObjectId(objectId),
  announcedBy: optionalObjectId(objectId),
  lessonType: optionalString(Joi.string().valid(...RESIDENCY_LESSON_TYPES)),
  status: optionalString(Joi.string().valid(...SESSION_STATUSES)),
  language: optionalString(),
});

const unsupervisedQuery = Joi.object({
  group: optionalObjectId(objectId),
  page,
  limit,
});

module.exports = {
  announceSchema,
  cancelSchema,
  idSchema,
  paginateQuery,
  unsupervisedQuery,
};
