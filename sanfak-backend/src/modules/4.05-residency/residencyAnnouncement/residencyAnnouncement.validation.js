const Joi = require("joi");
const { optionalString, optionalEnum, optionalNumber, optionalBoolean } = require("#validators/common");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");
const AUDIENCES = ["umumiy", "magistratura", "ordinatura", "kafedra_mudirlari"];

const base = {
  title: Joi.string().max(300),
  content: Joi.string().max(10000),
  audience: optionalEnum(Joi.string().valid(...AUDIENCES)),
  academicYear: Joi.string().allow(null, ""),
  deadline: Joi.date().allow(null, ""),
  active: optionalBoolean(),

  targetCourses: Joi.array().items(Joi.number().integer().min(1).max(10)).max(10),
  targetSpecialties: Joi.array().items(objectId).max(100),
};

exports.createSchema = Joi.object({
  ...base,
  title: base.title.required(),
  content: base.content.required(),
});

exports.updateSchema = Joi.object(base).min(1);

exports.idSchema = Joi.object({ id: objectId.required() });

exports.attachmentParams = Joi.object({
  id: objectId.required(),
  attachmentId: objectId.required(),
});

exports.listQuery = Joi.object({
  search: Joi.string().allow(""),
  audience: optionalString(Joi.string().valid(...AUDIENCES)),
  academicYear: optionalString(),
  active: optionalBoolean(),
  language: optionalString(),
});

exports.paginateQuery = exports.listQuery.keys({
  page: optionalNumber(Joi.number().min(1).default(1)),
  limit: optionalNumber(Joi.number().min(1).max(100).default(10)),
});
