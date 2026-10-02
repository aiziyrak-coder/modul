const Joi = require("joi");
const { optionalObjectId, optionalEnum } = require("#validators/common");

const createScheduleSchema = Joi.object({
  dayOfWeek: Joi.number().min(1).max(6).required(),
  timeSlot: Joi.string().required(),
  science: Joi.string().required(),
  teacher: Joi.string().required(),
  group: Joi.string().required(),
  room: Joi.string().required(),
  lessonType: optionalEnum(
    Joi.string().valid("maruza", "amaliy", "laboratoriya", "seminar"),
  ),
  semester: Joi.number().optional(),
  academicYear: optionalObjectId(),
});

const findAll = Joi.object({
  search: Joi.string().optional(),
  active: Joi.boolean().optional(),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: Joi.string().optional(),
  active: Joi.boolean().optional(),
});

const readSchema = Joi.object({
  id: Joi.string().required(),
});

const deleteSchema = Joi.object({
  id: Joi.string().required(),
});

const checkConflictSchema = Joi.object({
  dayOfWeek: Joi.number().required(),
  timeSlot: Joi.string().required(),
  room: Joi.string().optional(),
  teacher: Joi.string().optional(),
});

module.exports = {
  createScheduleSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
  checkConflictSchema,
};
