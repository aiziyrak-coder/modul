const Joi = require("joi");

const createWorkingScheduleSchema = Joi.object({
  learningProcess: Joi.string().required(),
  approval: Joi.string().required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid("draft", "in_review", "approved", "rejected")
    .required(),
});

const monthWeeksSchema = Joi.object({
  counts: Joi.array()
    .items(
      Joi.object({
        month: Joi.string().trim().min(1).max(20).required(),
        count: Joi.number().integer().min(1).max(52).required(),
      }),
    )
    .min(1)
    .max(12)
    .required(),
});

module.exports = { createWorkingScheduleSchema, updateStatusSchema, monthWeeksSchema };
