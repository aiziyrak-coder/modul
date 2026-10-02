const Joi = require("joi");
const {
  optionalString,
  optionalObjectId,
  optionalEnum,
  optionalNumber,
  optionalBoolean,
  optionalDate,
} = require("#validators/common");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");

const PROGRAMS = ["magistratura", "ordinatura"];

const fileSchema = Joi.object({
  url: Joi.string().required(),
  name: Joi.string().allow(null, ""),
  size: Joi.number().allow(null),
  uploadedAt: optionalDate(),
});

const base = {
  title: Joi.string().max(300),
  specialty: optionalObjectId(objectId),
  specialtyTitle: Joi.string().allow(null, ""),
  specialtyCode: Joi.string().allow(null, ""),
  program: Joi.string().valid(...PROGRAMS),
  educationForm: optionalString(),
  studyPeriod: optionalNumber(Joi.number().min(1).max(6)),
  approvedYear: Joi.number().min(1900).max(2200).allow(null, ""),
  academicYear: Joi.string().allow(null, ""),
  note: Joi.string().allow(null, "").max(2000),
  processFile: fileSchema.allow(null),
  planFile: fileSchema.allow(null),
  active: optionalBoolean(),
};

exports.createSchema = Joi.object({
  ...base,
  title: base.title.required(),
  program: base.program.required(),
});

exports.updateSchema = Joi.object(base).min(1);

exports.idSchema = Joi.object({ id: objectId.required() });

exports.listQuery = Joi.object({
  search: Joi.string().allow(""),
  specialty: optionalObjectId(objectId),
  program: optionalString(Joi.string().valid(...PROGRAMS)),
  academicYear: optionalString(),
  educationForm: optionalString(),
  active: optionalBoolean(),
  language: optionalString(),
});

exports.paginateQuery = exports.listQuery.keys({
  page: optionalNumber(Joi.number().min(1).default(1)),
  limit: optionalNumber(Joi.number().min(1).max(100).default(12)),
});
