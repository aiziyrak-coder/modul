const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const code = Joi.string().trim().max(20).allow("", null).optional();

const createScienceBranchSchema = Joi.object({
  title: multiLangSchema.required(),
  code,
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

const updateScienceBranchSchema = Joi.object({
  title: multiLangOptional.optional(),
  code,
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createScienceBranchSchema, updateScienceBranchSchema };
