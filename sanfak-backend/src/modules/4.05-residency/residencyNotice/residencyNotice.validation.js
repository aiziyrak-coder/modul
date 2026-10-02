const Joi = require("joi");
const { optionalString, optionalObjectId, optionalNumber, optionalBoolean } = require("#validators/common");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");
const PROGRAMS = ["magistratura", "ordinatura"];
const NOTICE_STATUSES = ["yangi", "kutilmoqda", "korib_chiqilgan"];
const CLIENT_NOTICE_KINDS = ["oddiy", "davomat"];
const NOTICE_KINDS = [...CLIENT_NOTICE_KINDS, "avtomatik"];

exports.createSchema = Joi.object({
  resident: optionalObjectId(objectId),
  program: Joi.string()
    .valid(...PROGRAMS)
    .required(),
  academicYear: Joi.string().allow(null, ""),
  title: Joi.string().max(300).required(),
  content: Joi.string().max(5000).required(),
  kind: Joi.string()
    .valid(...CLIENT_NOTICE_KINDS)
    .optional(),
});

exports.updateSchema = Joi.object({
  title: Joi.string().max(300),
  academicYear: Joi.string().allow(null, ""),
  content: Joi.string().max(5000),
}).min(1);

exports.reviewSchema = Joi.object({
  decision: Joi.string().max(5000).required(),
});

exports.idSchema = Joi.object({ id: objectId.required() });

exports.listQuery = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  program: optionalString(Joi.string().valid(...PROGRAMS)),
  status: optionalString(Joi.string().valid(...NOTICE_STATUSES)),
  academicYear: optionalString(),
  resident: optionalObjectId(objectId),
  kind: optionalString(Joi.string().valid(...NOTICE_KINDS)),
  active: optionalBoolean(),
  language: optionalString(),
});

exports.paginateQuery = exports.listQuery.keys({
  page: optionalNumber(Joi.number().min(1).default(1)),
  limit: optionalNumber(Joi.number().min(1).max(100).default(10)),
});

exports.streakQuery = Joi.object({
  resident: objectId.required(),
});
