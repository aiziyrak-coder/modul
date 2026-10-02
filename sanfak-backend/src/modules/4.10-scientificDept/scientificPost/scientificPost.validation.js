const Joi = require("joi");

const POST_RECIPIENTS = ["all", "teachers", "heads", "deans"];

const createPostSchema = Joi.object({
  title: Joi.string().trim().min(2).max(300).required(),
  text: Joi.string().trim().min(2).max(5000).required(),
  recipients: Joi.array()
    .items(Joi.string().valid(...POST_RECIPIENTS))
    .min(1)
    .required(),
  telegram: Joi.boolean().optional(),
  specialtyCode: Joi.string().trim().allow("").optional(),
});

const postQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
});

const postPaginateSchema = postQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  POST_RECIPIENTS,
  createPostSchema,
  postQuerySchema,
  postPaginateSchema,
};
