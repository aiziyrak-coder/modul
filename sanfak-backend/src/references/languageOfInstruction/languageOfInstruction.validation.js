const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const createLanguageOfInstructionSchema = Joi.object({
  title: multiLangSchema.required(),
  active: Joi.boolean().optional(),
});

const updateLanguageOfInstructionSchema = Joi.object({
  title: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

module.exports = {
  createLanguageOfInstructionSchema,
  updateLanguageOfInstructionSchema,
};
