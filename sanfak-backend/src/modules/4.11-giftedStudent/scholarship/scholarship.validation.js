const Joi = require("joi");
const { optionalString } = require("#validators/common");

const criterionSchema = Joi.object({
  criteria: Joi.string().required(),
  categoryIds: Joi.array().items(Joi.string()).optional(),
  pointOverrides: Joi.array()
    .items(
      Joi.object({
        categoryId: Joi.string().required(),
        points: Joi.number().required(),
      }),
    )
    .optional(),
  typePointOverride: Joi.number().optional(),
});

const scholarshipSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow("").optional(),
  type: Joi.string().valid("nomdor", "rektor").required(),
  minScore: Joi.number().optional(),
  amount: Joi.string().allow("").optional(),
  deadline: Joi.date().optional(),
  academicYear: optionalString(),
  allowedCourses: Joi.array().items(Joi.string()).optional(),
  active: Joi.boolean().optional(),

  judges: Joi.array()
    .items(Joi.string())
    .unique()
    .messages({ "array.unique": "Bir hakam ikki marta qo'shilgan" })
    .optional(),
  criteria: Joi.array()
    .items(criterionSchema)
    .unique((a, b) => a.criteria === b.criteria)
    .messages({ "array.unique": "Bir faoliyat turi ikki marta qo'shilgan" })
    .optional(),
});

const updateSchema = scholarshipSchema.fork(["name", "type"], (s) => s.optional());

const findAll = Joi.object({
  type: optionalString(Joi.string().valid("nomdor", "rektor")),
  academicYear: optionalString(),
  active: Joi.boolean().optional(),
  search: optionalString(Joi.string().trim()),
});

const paginate = findAll.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const readSchema = Joi.object({ id: Joi.string().required() });
const deleteSchema = Joi.object({ id: Joi.string().required() });

module.exports = {
  scholarshipSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
};
