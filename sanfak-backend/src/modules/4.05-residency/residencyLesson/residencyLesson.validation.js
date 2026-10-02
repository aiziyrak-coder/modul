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

const groupItem = Joi.object({
  group: objectId.required(),
  title: Joi.string().allow(null, ""),
});

const base = {
  academicYear: Joi.string().allow(null, ""),
  courseNumber: Joi.number().min(1).max(6).allow(null),
  science: objectId,
  scienceTitle: Joi.string().allow(null, ""),
  department: optionalObjectId(objectId),
  departmentTitle: Joi.string().allow(null, ""),
  teacher: optionalObjectId(objectId),
  teacherName: Joi.string().allow(null, ""),
  groups: Joi.array().items(groupItem),
  startDate: optionalDate(),
  endDate: optionalDate(),
  active: optionalBoolean(),
};

exports.createSchema = Joi.object({
  ...base,
  science: base.science.required(),
  startDate: base.startDate.required(),
  endDate: base.endDate.required().min(Joi.ref("startDate")),
});

exports.updateSchema = Joi.object(base).min(1);

exports.idSchema = Joi.object({ id: objectId.required() });

exports.listQuery = Joi.object({
  search: Joi.string().allow(""),
  academicYear: optionalString(),
  science: optionalObjectId(objectId),
  courseNumber: optionalString(Joi.string().pattern(COURSE_QUERY)),
  group: optionalObjectId(objectId),
  fromDate: optionalDate(),
  toDate: optionalDate(),
  active: optionalBoolean(),
  language: optionalString(),
});

exports.paginateQuery = exports.listQuery.keys({
  page: optionalNumber(Joi.number().min(1).default(1)),
  limit: optionalNumber(Joi.number().min(1).max(100).default(10)),
});
