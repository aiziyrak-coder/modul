const Joi = require("joi");
const {
  optionalString,
  optionalObjectId,
  findAll,
  paginate,
} = require("#validators/common");

const submissionQuery = findAll.keys({
  teacher: Joi.string().optional(),
  indicator: Joi.string().optional(),
  semester: Joi.number().valid(1, 2).optional(),
});

const submissionPaginateQuery = paginate.keys({
  teacher: Joi.string().optional(),
  indicator: Joi.string().optional(),
  semester: Joi.number().valid(1, 2).optional(),
});

const submissionSchema = Joi.object({
  indicator: Joi.string().required(),
  academicYear: optionalObjectId(),
  semester: Joi.number().valid(1, 2).optional(),
  data: Joi.object().optional(),
  authorShare: Joi.number().min(0).max(100).optional(),
});

const updateSchema = Joi.object({
  indicator: Joi.string().optional(),
  academicYear: optionalObjectId(),
  semester: Joi.number().valid(1, 2).optional(),
  data: Joi.object().optional(),
  authorShare: Joi.number().min(0).max(100).optional(),
});

const reviewSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
  comment: optionalString(),
  authorShare: Joi.number().min(0).max(100).optional(),
});

module.exports = {
  submissionSchema,
  updateSchema,
  reviewSchema,
  submissionQuery,
  submissionPaginateQuery,
};
