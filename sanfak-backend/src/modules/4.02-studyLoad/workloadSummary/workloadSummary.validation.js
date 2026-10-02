const Joi = require("joi");
const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");

const academicYearInput = Joi.alternatives().try(
  Joi.string().hex().length(24),
  Joi.string().pattern(/^\d{4}\s*[-/]\s*\d{4}$/),
);

const createSummarySchema = Joi.object({
  academicYear: academicYearInput.required(),
});

const paginateSummaryQuery = paginate.keys({
  academicYear: academicYearInput.optional(),
  status: Joi.string()
    .valid("draft", "in_review", "approved", "rejected", "superseded")
    .optional(),
});

const approveSummarySchema = Joi.object({
  signature: Joi.string().allow("", null).optional(),
  eriSignature: Joi.string().allow("", null).optional(),
  eriSerial: Joi.string().allow("", null).optional(),
});

const rejectSummarySchema = Joi.object({
  comment: Joi.string().max(1000).allow("", null).optional(),
});

module.exports = {
  academicYearInput,
  createSummarySchema,
  paginateSummaryQuery,
  approveSummarySchema,
  rejectSummarySchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
};
