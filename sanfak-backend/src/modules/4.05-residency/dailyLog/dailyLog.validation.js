const Joi = require("joi");
const {
  DAILY_LOG_STATUSES,
  SKILL_COUNT_MIN,
  SKILL_COUNT_MAX,
} = require("./dailyLog.model");
const {
  optionalString,
  optionalObjectId,
  optionalNumber,
  optionalDate,
} = require("#validators/common");

const skillItem = Joi.object({
  skillId: optionalObjectId(),
  skill: Joi.string().allow("", null),
  count: optionalNumber(Joi.number().min(SKILL_COUNT_MIN).max(SKILL_COUNT_MAX)),
});
const countedItem = Joi.object({
  title: Joi.string().allow("", null),
  count: optionalNumber(),
});
const str = Joi.string().allow("", null);

const createDailyLogSchema = Joi.object({
  resident: optionalObjectId(),
  date: Joi.date().required(),
  workType: str.optional(),
  semester: str.optional(),
  clinicalWork: str.optional(),
  skills: Joi.array().items(skillItem).optional(),
  treatments: Joi.array().items(countedItem).optional(),
  practicalSkills: Joi.array().items(countedItem).optional(),
  fileUrl: str.optional(),
  comment: str.optional(),
});

const updateDailyLogSchema = Joi.object({
  date: optionalDate(),
  workType: str.optional(),
  semester: str.optional(),
  clinicalWork: str.optional(),
  skills: Joi.array().items(skillItem).optional(),
  treatments: Joi.array().items(countedItem).optional(),
  practicalSkills: Joi.array().items(countedItem).optional(),
  fileUrl: str.optional(),
  comment: str.optional(),
});

const approveSchema = Joi.object({
  comment: str.optional(),
});

const returnSchema = Joi.object({
  reason: Joi.string().min(1).max(1000).required(),
});

const listQuery = Joi.object({
  resident: optionalObjectId(),
  status: optionalString(Joi.string().valid(...DAILY_LOG_STATUSES)),
  page: optionalNumber(Joi.number().integer()),
  limit: optionalNumber(Joi.number().integer()),
});

const byResidentQuery = Joi.object({
  startDate: optionalDate(),
  endDate: optionalDate(),
  status: optionalString(Joi.string().valid(...DAILY_LOG_STATUSES)),
});

const idSchema = Joi.object({ id: Joi.string().required() });
const residentIdParam = Joi.object({ residentId: Joi.string().required() });

module.exports = {
  createDailyLogSchema,
  updateDailyLogSchema,
  approveSchema,
  returnSchema,
  listQuery,
  byResidentQuery,
  idSchema,
  residentIdParam,
};
