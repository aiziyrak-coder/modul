const Joi = require("joi");

const multiLangSchema = Joi.string().min(1).required();
const multiLangOptional = Joi.string().allow("", null);

const optionalString = (schema = Joi.string()) => schema.optional().allow("", null);

const optionalObjectId = (schema = Joi.string()) =>
  Joi.any()
    .optional()
    .allow(null)
    .custom((value, helpers) => {
      if (value === "" || value === null) return null;
      const { error, value: cast } = schema.validate(value);
      if (error) return helpers.message(error.details[0].message);
      return cast;
    });

const optionalEnum = (schema) => schema.optional().empty(Joi.valid(null, ""));

const optionalNumber = (schema = Joi.number()) => schema.optional().empty(Joi.valid(null, ""));
const optionalBoolean = (schema = Joi.boolean()) => schema.optional().empty(Joi.valid(null, ""));
const optionalDate = (schema = Joi.date()) => schema.optional().empty(Joi.valid(null, ""));

const academicYearInput = Joi.alternatives().try(
  Joi.string().hex().length(24),
  Joi.string().pattern(/^\d{4}\s*[-/]\s*\d{4}$/),
);

const findAll = Joi.object({
  search: Joi.string().optional(),
  active: Joi.boolean().optional(),
  division: Joi.string().optional(),
  department: Joi.string().optional(),
  course: Joi.string().optional(),
  room: Joi.string().optional(),
  position: Joi.string().optional(),
  direction: Joi.string().optional(),
  faculty: Joi.string().optional(),
  language: Joi.string().valid("uz", "ru", "eng").optional(),
  stage: Joi.string().optional(),
  year: Joi.string().optional(),
  status: Joi.string().optional(),
  kind: Joi.number().optional(),
  startDate: Joi.string().optional(),
  endDate: Joi.string().optional(),
  paymentStatus: Joi.number().optional(),
  academicYear: Joi.string().optional(),
  workload: Joi.string().optional(),
  form: Joi.number().optional(),
  excludeDistributed: Joi.boolean().optional(),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: Joi.string().optional(),
  direction: Joi.string().optional(),
  course: Joi.string().optional(),
  position: Joi.string().optional(),
  room: Joi.string().optional(),
  division: Joi.string().optional(),
  faculty: Joi.string().optional(),
  department: Joi.string().optional(),
  active: Joi.boolean().optional(),
  language: Joi.string().valid("uz", "ru", "eng").optional(),
  stage: Joi.string().optional(),
  year: Joi.string().optional(),
  status: Joi.string().optional(),
  kind: Joi.number().optional(),
  startDate: Joi.string().optional(),
  endDate: Joi.string().optional(),
  paymentStatus: Joi.number().optional(),
  academicYear: Joi.string().optional(),
  workload: Joi.string().optional(),
  form: Joi.number().optional(),
});

const langIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("lang ObjectId (LanguageOfInstruction _id) bo'lishi kerak");

const findAllGroups = Joi.object({
  search: Joi.string().optional(),
  active: Joi.boolean().optional(),
  language: Joi.string().valid("uz", "ru", "eng").optional(),
  direction: Joi.string().optional(),
  course: Joi.string().optional(),
  lang: langIdSchema.optional(),
  academicYear: Joi.string().optional(),
});

const paginateGroups = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: Joi.string().optional(),
  active: Joi.boolean().optional(),
  language: Joi.string().valid("uz", "ru", "eng").optional(),
  direction: Joi.string().optional(),
  course: Joi.string().optional(),
  lang: langIdSchema.optional(),
  academicYear: Joi.string().optional(),
});

const readSchema = Joi.object({
  id: Joi.string().required(),
});

const readSchemaQuery = Joi.object({
  language: Joi.string().valid("uz", "ru", "eng").optional(),
});

const deleteSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  multiLangSchema,
  multiLangOptional,
  optionalString,
  optionalObjectId,
  optionalEnum,
  optionalNumber,
  optionalBoolean,
  optionalDate,
  academicYearInput,
  findAll,
  paginate,
  findAllGroups,
  paginateGroups,
  readSchema,
  deleteSchema,
  readSchemaQuery,
};
