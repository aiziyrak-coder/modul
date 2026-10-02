const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const PASSPORT_NUMBER = optionalString(
  Joi.string()
    .pattern(/^\d{7}$/)
    .message("passportNumber: aniq 7 ta raqam bo'lishi kerak"),
);

const EMPLOYMENT_TYPES = ["asosiy", "orindosh"];

const createSchema = Joi.object({
  employmentType: Joi.string().valid(...EMPLOYMENT_TYPES).allow(null, "").optional(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  middleName: optionalString(),
  passportSeria: optionalString(),
  passportNumber: PASSPORT_NUMBER,
  role: optionalObjectId(),
  position: optionalObjectId(),
  division: optionalObjectId(),
  department: optionalObjectId(),
  faculty: optionalObjectId(),
  phone: optionalString(),
  email: optionalString(Joi.string().email()),
  oneIdPin: optionalString(),
  active: Joi.boolean().optional(),
  academicTitle: optionalObjectId(),
  publications: Joi.number().optional().allow(null, ""),
  hIndex: Joi.number().optional().allow(null, ""),
  workingHours: optionalString(),
  office: optionalString(),
});

const findAll = Joi.object({
  search: optionalString(),
  active: Joi.boolean().optional(),
  role: optionalObjectId(),
  position: optionalObjectId(),
  division: optionalObjectId(),
  language: optionalString(Joi.string().valid("uz", "ru", "eng")),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: optionalString(),
  active: Joi.boolean().optional(),
  role: optionalObjectId(),
  position: optionalObjectId(),
  division: optionalObjectId(),
  language: optionalString(Joi.string().valid("uz", "ru", "eng")),
});

const roleFilter = Joi.alternatives().try(
  Joi.array().items(Joi.string()).min(1),
  Joi.string(),
);

const lookupSchema = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  limit: Joi.number().integer().min(1).optional(),
  role: roleFilter.optional(),
});

const readSchema = Joi.object({
  id: Joi.string().required(),
  language: Joi.string().valid("uz", "ru", "eng").optional(),
});

const readSchemaQuery = Joi.object({
  language: optionalString(Joi.string().valid("uz", "ru", "eng")),
});

const updateSchema = Joi.object({
  employmentType: Joi.string().valid(...EMPLOYMENT_TYPES).allow(null, "").optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  middleName: optionalString(),
  oneIdPin: optionalString(),
  email: optionalString(Joi.string().email()),
  phone: optionalString(),
  role: optionalObjectId(),
  position: optionalObjectId(),
  division: optionalObjectId(),
  department: optionalObjectId(),
  faculty: optionalObjectId(),
  passportNumber: PASSPORT_NUMBER,
  passportSeria: optionalString(),
  active: Joi.boolean().optional(),
  academicTitle: optionalObjectId(),
  publications: Joi.number().optional().allow(null, ""),
  hIndex: Joi.number().optional().allow(null, ""),
  workingHours: optionalString(),
  office: optionalString(),
});

const updateSchemaProfessor = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  middleName: optionalString(),
  email: optionalString(Joi.string().email()),
  phone: optionalString(),
  photo: optionalString(),
  department: optionalObjectId(),
  faculty: optionalObjectId(),
  googleScholar: optionalString(),
  scopus: optionalString(),
  degrees: Joi.object().optional()
});

const deleteFileSchema = Joi.object({
  userId: Joi.string().required(),
  degreeType: Joi.string().required(),
  fileId: Joi.string().required()
});

const deleteSchema = Joi.object({
  id: Joi.string().required(),
});

const changeStatusSchema = Joi.object({
  active: Joi.boolean().required(),
});

const revokeSessionsSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createSchema,
  updateSchema,
  deleteSchema,
  readSchema,
  findAll,
  paginate,
  lookupSchema,
  changeStatusSchema,
  readSchemaQuery,
  updateSchemaProfessor,
  deleteFileSchema,
  revokeSessionsSchema,
};
