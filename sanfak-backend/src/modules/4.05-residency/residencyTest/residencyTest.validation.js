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

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");
const str = Joi.string().allow("", null);
const program = Joi.string().valid("magistratura", "ordinatura");

const base = {
  title: Joi.string().min(1).max(500),
  scienceTitle: str,
  science: optionalObjectId(objectId),
  specialty: optionalObjectId(objectId),
  specialtyTitle: str,
  program: optionalString(program),
  courseNumber: optionalNumber(Joi.number().integer().min(1).max(10)),
  group: optionalObjectId(objectId),
  groupTitle: str,
  academicYear: str,
  date: Joi.date(),
  maxScore: optionalNumber(Joi.number().integer().min(1).max(100)),
  questionCount: optionalNumber(Joi.number().integer().min(1).max(1000)),
  desc: Joi.string().max(5000).allow(null, ""),
  fileUrl: Joi.string(),
  fileName: str,
  fileSize: optionalNumber(Joi.number()),
  format: str,
  active: optionalBoolean(),
};

exports.createSchema = Joi.object({
  ...base,
  title: base.title.required(),
  date: base.date.required(),
  fileUrl: base.fileUrl.required(),
});

exports.updateSchema = Joi.object(base).min(1);

exports.idSchema = Joi.object({ id: objectId.required() });

exports.listQuery = Joi.object({
  search: Joi.string().trim().allow(""),
  academicYear: optionalString(),
  courseNumber: optionalString(Joi.string().pattern(COURSE_QUERY)),
  group: optionalObjectId(objectId),
  specialty: optionalObjectId(objectId),
  program: optionalString(program),
  page: optionalNumber(Joi.number().integer().min(1).default(1)),
  limit: optionalNumber(Joi.number().integer().min(1).max(100).default(10)),
});

exports.previewQuery = Joi.object({
  specialty: optionalObjectId(objectId),
  program: optionalString(program),
  courseNumber: optionalString(Joi.string().pattern(COURSE_QUERY)),
  group: optionalObjectId(objectId),
  academicYear: optionalString(),
});

exports.resultsSchema = Joi.object({
  results: Joi.array()
    .min(1)
    .max(500)
    .items(
      Joi.object({
        resident: objectId.required(),
        score: Joi.number().min(0).allow(null).required(),
      }),
    )
    .required(),
});
