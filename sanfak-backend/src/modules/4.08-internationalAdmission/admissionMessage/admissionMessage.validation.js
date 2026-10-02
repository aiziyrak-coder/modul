const Joi = require("joi");
const AdmissionSeason = require("../admissionSeason/admissionSeason.model");
const { idParam, baseQuery, withPagination } = require("../lib/commonValidation");
const { optionalObjectId, optionalString } = require("#validators/common");

const { SEASON_NAMES } = AdmissionSeason;

const objectId = Joi.string().hex().length(24);

const sendSchema = Joi.object({
  text: Joi.string().trim().min(3).max(5000).required(),
  direction: optionalObjectId(objectId),
  educationLanguage: optionalObjectId(objectId),
  academicYear: Joi.string().trim().pattern(/^\d{4}\/\d{4}$/).required(),
  season: Joi.string().valid(...SEASON_NAMES).required(),
});

const findAll = baseQuery.keys({
  direction: optionalObjectId(objectId),
  educationLanguage: optionalObjectId(objectId),
  academicYear: optionalString(),
  season: optionalString(Joi.string().valid(...SEASON_NAMES)),
});

const previewQuery = Joi.object({
  direction: optionalObjectId(objectId),
  educationLanguage: optionalObjectId(objectId),
  academicYear: Joi.string().trim().max(20).optional(),
});

module.exports = {
  SEASON_NAMES,
  sendSchema,
  findAll,
  paginate: withPagination(findAll),
  previewQuery,
  readSchema: idParam,
};
