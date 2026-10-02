const Joi = require("joi");
const { optionalObjectId, optionalString } = require("#validators/common");

const objectId = Joi.string().length(24).hex();

const createSchema = Joi.object({
  document: Joi.string().required(),
  documentType: Joi.string().required(),
  moduleName: Joi.string().required(),
  steps: Joi.array().items(Joi.object({
    order: Joi.number().required(),
    roleTitle: Joi.string().required(),
    user: optionalObjectId(objectId),
  })).min(1).required(),
});

const signSchema = Joi.object({
  eriSignature: Joi.string().optional(),
  comment: optionalString(),
});

const rejectSchema = Joi.object({
  comment: Joi.string().required(),
});

module.exports = { createSchema, signSchema, rejectSchema };
