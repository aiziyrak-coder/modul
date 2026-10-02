const Joi = require("joi");
const { optionalString } = require("#validators/common");

const ACHIEVEMENT_STATUSES = ["new", "approved", "rejected"];

const achievementQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: optionalString(Joi.string().valid(...ACHIEVEMENT_STATUSES)),
  academicYear: optionalString(),
  faculty: optionalString(Joi.string().hex().length(24)),
  department: optionalString(Joi.string().hex().length(24)),
  author: optionalString(Joi.string().hex().length(24)),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const achievementPaginateSchema = achievementQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

const rejectAchievementSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(2000).required(),
});

const academicYearField = optionalString(Joi.string().pattern(/^\d{4}\/\d{4}$/));
const mediaField = Joi.any();

module.exports = {
  ACHIEVEMENT_STATUSES,
  achievementQuerySchema,
  achievementPaginateSchema,
  rejectAchievementSchema,
  academicYearField,
  mediaField,
};
