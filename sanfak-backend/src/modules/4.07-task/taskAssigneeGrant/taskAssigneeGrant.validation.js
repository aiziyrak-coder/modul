const Joi = require("joi");
const { optionalString, optionalObjectId, optionalBoolean } = require("#validators/common");

const listQuery = Joi.object({
  search: optionalString(),
  role: optionalObjectId(),
  active: optionalBoolean(),
  page: Joi.number().integer().optional(),
  limit: Joi.number().integer().optional(),
});

const assignerParams = Joi.object({
  assignerId: Joi.string().required(),
});

const grantParams = Joi.object({
  assignerId: Joi.string().required(),
  assigneeId: Joi.string().required(),
});

const replaceSchema = Joi.object({
  assignees: Joi.array().items(Joi.string()).required(),
});

const addSchema = Joi.object({
  assignees: Joi.array().items(Joi.string()).min(1).required(),
});

module.exports = { listQuery, assignerParams, grantParams, replaceSchema, addSchema };
