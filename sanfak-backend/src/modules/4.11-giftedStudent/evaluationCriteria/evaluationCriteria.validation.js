const Joi = require("joi");
const { optionalString } = require("#validators/common");

const categorySchema = Joi.object({
  _id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/, "ObjectId")
    .optional(),
  name: Joi.string().required(),
  points: Joi.number().min(0).optional(),
  active: Joi.boolean().optional(),
});

const criteriaSchema = Joi.object({
  name: Joi.string().required(),
  icon: Joi.string().allow("").optional(),
  maxPoints: Joi.number().min(0).optional(),
  categories: Joi.array().items(categorySchema).optional(),
  active: Joi.boolean().optional(),
});

const updateSchema = criteriaSchema.fork(["name"], (s) => s.optional());

const findAll = Joi.object({
  search: optionalString(Joi.string().trim()),
  active: Joi.boolean().optional(),
});

const readSchema = Joi.object({ id: Joi.string().required() });
const deleteSchema = Joi.object({ id: Joi.string().required() });

module.exports = { criteriaSchema, updateSchema, findAll, readSchema, deleteSchema };
