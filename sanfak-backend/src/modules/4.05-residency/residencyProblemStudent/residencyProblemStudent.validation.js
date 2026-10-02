const Joi = require("joi");
const {
  optionalString,
  optionalObjectId,
  optionalNumber,
  optionalBoolean,
  optionalDate,
} = require("#validators/common");
const {
  COURSE_QUERY,
} = require("#modules/4.05-residency/_services/courseFilter");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");
const PROGRAMS = ["magistratura", "ordinatura"];

const base = {
  academicYear: Joi.string().allow(null, ""),
  department: optionalObjectId(objectId),
  departmentTitle: Joi.string().allow(null, ""),
  program: Joi.string().valid(...PROGRAMS),
  specialty: optionalObjectId(objectId),
  specialtyTitle: Joi.string().allow(null, ""),
  resident: optionalObjectId(objectId),
  fullName: Joi.string().max(300),
  courseNumber: Joi.number().min(1).max(6).allow(null),
  group: optionalObjectId(objectId),
  groupTitle: Joi.string().allow(null, ""),
  date: optionalDate(),
  content: Joi.string().max(5000),
  conclusion: Joi.string().max(5000).allow(null, ""),
  active: optionalBoolean(),
};

exports.createSchema = Joi.object({
  ...base,
  program: base.program.required(),
  fullName: base.fullName.required(),
  content: base.content.required(),
});

exports.updateSchema = Joi.object(base).min(1);

exports.idSchema = Joi.object({ id: objectId.required() });

exports.listQuery = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  academicYear: optionalString(),
  program: optionalString(Joi.string().valid(...PROGRAMS)),
  specialty: optionalObjectId(objectId),
  department: optionalObjectId(objectId),
  courseNumber: optionalString(Joi.string().pattern(COURSE_QUERY)),
  group: optionalObjectId(objectId),
  active: optionalBoolean(),
  language: optionalString(),
});

exports.paginateQuery = exports.listQuery.keys({
  page: optionalNumber(Joi.number().min(1).default(1)),
  limit: optionalNumber(Joi.number().min(1).max(100).default(10)),
});
