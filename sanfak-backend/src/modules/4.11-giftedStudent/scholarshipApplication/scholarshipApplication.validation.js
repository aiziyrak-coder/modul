const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const applySchema = Joi.object({
  scholarship: optionalObjectId(),
  type: Joi.string()
    .valid("rektor_stipendiyasi", "nomdor_stipendiya", "davlat_granti", "other")
    .required(),
  scholarshipName: Joi.string().max(200).optional().allow(null, ""),
  motivation: Joi.string().max(2000).optional().allow(null, ""),
  period: Joi.string().max(100).optional().allow(null, ""),
  academicYear: Joi.string().max(24).optional().allow(null, ""),
  documents: Joi.array()
    .items(
      Joi.object({
        title: optionalString(),
        fileUrl: optionalString(),
      }),
    )
    .optional(),
});

const reviewSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
  rejectReason: Joi.string()
    .max(1000)
    .when("status", {
      is: "rejected",
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ""),
    }),
  amount: Joi.number().min(0).optional().allow(null),
  period: Joi.string().max(100).optional().allow(null, ""),
});

const scoreSchema = Joi.object({
  scores: Joi.array()
    .items(
      Joi.object({
        criteria: Joi.string().required(),
        categoryId: Joi.string().optional().allow(null, ""),
        value: Joi.number().min(0).required(),
      }),
    )
    .required(),
});

const findAll = Joi.object({
  search: optionalString(Joi.string().trim()),
  type: optionalString(),
  status: optionalString(),
  page: Joi.number().integer().optional(),
  limit: Joi.number().integer().optional(),
});

module.exports = { applySchema, reviewSchema, scoreSchema, findAll };
