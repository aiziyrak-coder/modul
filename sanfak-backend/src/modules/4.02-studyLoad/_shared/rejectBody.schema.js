"use strict";

const Joi = require("joi");

const REJECT_COMMENT_MAX = 1000;

const rejectCommentSchema = Joi.object({
  comment: Joi.string()
    .trim()
    .min(1)
    .max(REJECT_COMMENT_MAX)
    .required()
    .messages({
      "any.required": "Rad etish sababi (comment) majburiy",
      "string.base": "Rad etish sababi matn bo'lishi kerak",
      "string.empty": "Rad etish sababi bo'sh bo'lmasin",
      "string.min": "Rad etish sababi bo'sh bo'lmasin",
      "string.max": `Rad etish sababi ${REJECT_COMMENT_MAX} belgidan oshmasin`,
    }),
  signature: Joi.string().optional().allow("", null),
  eriSignature: Joi.string().optional().allow("", null),
  eriSerial: Joi.string().optional().allow("", null),
});

module.exports = { REJECT_COMMENT_MAX, rejectCommentSchema };
