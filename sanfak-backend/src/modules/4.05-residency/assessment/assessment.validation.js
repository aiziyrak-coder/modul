const Joi = require("joi");
const { ASSESSMENT_TYPES } = require("./assessment.model");
const {
  optionalString,
  optionalObjectId,
  optionalNumber,
  optionalBoolean,
  optionalDate,
} = require("#validators/common");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");

const base = {
  resident: objectId,
  science: optionalObjectId(objectId),
  type: Joi.string().valid(...ASSESSMENT_TYPES),
  score: optionalNumber(Joi.number().min(0)),
  maxScore: optionalNumber(Joi.number().min(1).default(100)),
  attestationAllowed: optionalBoolean(),
  active: optionalBoolean(),
};

exports.createSchema = Joi.object({
  ...base,
  resident: base.resident.required(),
});

exports.gradeSchema = Joi.object({
  resident: objectId.required(),
  science: optionalObjectId(objectId),
  type: Joi.string()
    .valid(...ASSESSMENT_TYPES)
    .required(),
  score: Joi.number().min(0).required(),
  maxScore: optionalNumber(Joi.number().min(1).default(100)),
});

exports.updateSchema = Joi.object(base).min(1);

exports.idSchema = Joi.object({ id: objectId.required() });
exports.residentIdSchema = Joi.object({ residentId: objectId.required() });

exports.eligibilityQuery = Joi.object({
  science: optionalObjectId(objectId),
  fromDate: optionalDate(),
  toDate: optionalDate(),
});

exports.listQuery = Joi.object({
  resident: optionalObjectId(objectId),
  science: optionalObjectId(objectId),
  test: optionalObjectId(objectId),
  type: optionalString(Joi.string().valid(...ASSESSMENT_TYPES)),
  active: optionalBoolean(),
  language: optionalString(),
});

exports.paginateQuery = exports.listQuery.keys({
  page: optionalNumber(Joi.number().min(1).default(1)),
  limit: optionalNumber(Joi.number().min(1).max(100).default(10)),
});

exports.createAssessmentSchema = exports.createSchema;
