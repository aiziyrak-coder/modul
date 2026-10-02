const Joi = require("joi");

const createDecisionSchema = Joi.object({
  work: Joi.string().required(),
  type: Joi.string().valid("seminar", "revision", "rejection").required(),
  finalConclusion: Joi.string().allow("", null),
  comment: Joi.string().allow("", null),
  revisionDocs: Joi.array().items(Joi.string()).optional(),
  seminarDate: Joi.date().optional(),
  rejectionReason: Joi.string().allow("", null),
});

module.exports = { createDecisionSchema };
