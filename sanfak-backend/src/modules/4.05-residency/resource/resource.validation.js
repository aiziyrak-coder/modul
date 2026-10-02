const Joi = require("joi");
const {
  optionalString,
  optionalObjectId,
  optionalEnum,
  optionalNumber,
  optionalBoolean,
} = require("#validators/common");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");

const RESOURCE_TYPES = ["kitob", "atlas", "video", "metodik", "protokol", "qollanma"];

const base = {
  department: optionalObjectId(objectId),
  title: Joi.string().max(500),
  resourceType: optionalEnum(Joi.string().valid(...RESOURCE_TYPES)),
  specialty: optionalObjectId(objectId),
  specialtyTitle: Joi.string().allow(null, ""),
  author: Joi.string().max(300).allow(null, ""),
  publishYear: Joi.number().min(1800).max(2200).allow(null, ""),
  desc: Joi.string().max(5000).allow(null, ""),
  fileUrl: Joi.string(),
  fileName: Joi.string().allow(null, ""),
  fileSize: Joi.number().allow(null),
  format: Joi.string().allow(null, ""),
  active: optionalBoolean(),
};

exports.createSchema = Joi.object({
  ...base,
  title: base.title.required(),
  fileUrl: base.fileUrl.required(),
});

exports.updateSchema = Joi.object(base).min(1);

exports.idSchema = Joi.object({ id: objectId.required() });

exports.listQuery = Joi.object({
  search: Joi.string().trim().allow(""),
  resourceType: optionalString(Joi.string().valid(...RESOURCE_TYPES)),
  specialty: optionalObjectId(objectId),
  department: optionalObjectId(objectId),
  active: optionalBoolean(),
  language: optionalString(),
});

exports.paginateQuery = exports.listQuery.keys({
  page: optionalNumber(Joi.number().min(1).default(1)),
  limit: optionalNumber(Joi.number().min(1).max(100).default(10)),
});

exports.createResourceSchema = exports.createSchema;
