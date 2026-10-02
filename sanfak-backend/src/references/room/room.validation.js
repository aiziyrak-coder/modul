const Joi = require("joi");
const {
  multiLangSchema,
  multiLangOptional,
  optionalString,
} = require("#validators/common");

const createRoomSchema = Joi.object({
  title: multiLangSchema.required(),
  building: multiLangOptional.optional(),
  capacity: Joi.number().optional(),
  type: optionalString(),
  active: Joi.boolean().optional(),
});

const updateRoomSchema = Joi.object({
  title: multiLangSchema.optional(),
  building: multiLangOptional.optional(),
  capacity: Joi.number().optional(),
  type: optionalString(),
  active: Joi.boolean().optional(),
});

module.exports = { createRoomSchema, updateRoomSchema };
