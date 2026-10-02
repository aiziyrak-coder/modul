const Joi = require("joi");
const { SEMESTERS } = require("./residencySkill.model");
const { optionalString, optionalObjectId, optionalNumber, optionalBoolean } = require("#validators/common");

const createSchema = Joi.object({
  specialty: Joi.string().required(),
  specialtyTitle: optionalString(),
  semester: Joi.string()
    .valid(...SEMESTERS)
    .required(),
  theoryTopic: Joi.string().required(),
  theoryTopicTitle: optionalString(),
  practicalSkill: Joi.string().min(1).required(),
  patientCount: optionalNumber(Joi.number().integer().min(1)),
  active: optionalBoolean(),
});

const updateSchema = Joi.object({
  specialty: Joi.string().optional(),
  specialtyTitle: optionalString(),
  semester: Joi.string()
    .valid(...SEMESTERS)
    .optional(),
  theoryTopic: Joi.string().optional(),
  theoryTopicTitle: optionalString(),
  practicalSkill: Joi.string().min(1).optional(),
  patientCount: optionalNumber(Joi.number().integer().min(1)),
  active: optionalBoolean(),
});

const listQuery = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  specialty: optionalObjectId(),
  semester: optionalString(Joi.string().valid(...SEMESTERS)),
  active: optionalBoolean(),
});

const paginateQuery = listQuery.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const progressQuery = Joi.object({
  academicYear: optionalObjectId(),
  specialty: optionalObjectId(),
  semester: optionalString(Joi.string().valid(...SEMESTERS)),
  courseNumber: optionalNumber(),
  group: optionalString(),
  program: optionalString(Joi.string().valid("magistratura", "ordinatura")),
});

const idSchema = Joi.object({ id: Joi.string().required() });

module.exports = {
  createSchema,
  updateSchema,
  listQuery,
  paginateQuery,
  progressQuery,
  idSchema,
};
