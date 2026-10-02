const Joi = require("joi");
const {
  optionalString,
  optionalObjectId,
  optionalNumber,
  optionalBoolean,
} = require("#validators/common");
const {
  COURSE_QUERY,
} = require("#modules/4.05-residency/_services/courseFilter");

const objId = optionalObjectId();
const str = Joi.string().allow("", null);
const program = Joi.string().valid("magistratura", "ordinatura").allow(null, "");

const createSchema = Joi.object({
  scienceTitle: Joi.string().min(1).required(),
  science: objId.optional(),
  specialty: objId.optional(),
  specialtyTitle: str.optional(),
  program: program.optional(),
  courseNumber: Joi.number().allow(null).optional(),
  group: objId.optional(),
  groupTitle: str.optional(),
  academicYear: str.optional(),
  date: Joi.date().required(),
});

const updateSchema = createSchema.fork(["scienceTitle", "date"], (s) => s.optional());

const previewQuery = Joi.object({
  specialty: optionalObjectId(),
  program: optionalString(Joi.string().valid("magistratura", "ordinatura")),
  courseNumber: optionalString(Joi.string().pattern(COURSE_QUERY)),
  group: optionalObjectId(),
  academicYear: optionalString(),
});

const listQuery = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  academicYear: optionalString(),
  courseNumber: optionalString(Joi.string().pattern(COURSE_QUERY)),
  group: optionalObjectId(),
  specialty: optionalObjectId(),
  page: optionalNumber(Joi.number().integer()),
  limit: optionalNumber(Joi.number().integer()),
});

const resultUpdateSchema = Joi.object({
  score: Joi.number().min(0).max(100).allow(null).optional(),
  included: optionalBoolean(),
  excludeReason: str.optional(),
});

const idSchema = Joi.object({ id: Joi.string().required() });
const resultParam = Joi.object({
  id: Joi.string().required(),
  resultId: Joi.string().required(),
});

module.exports = {
  createSchema,
  updateSchema,
  previewQuery,
  listQuery,
  resultUpdateSchema,
  idSchema,
  resultParam,
};
