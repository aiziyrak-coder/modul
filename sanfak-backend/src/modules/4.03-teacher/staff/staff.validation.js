"use strict";

const Joi = require("joi");
const { optionalObjectId, optionalEnum } = require("#validators/common");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ObjectId formatida bo'lishi kerak");

const staffFields = {
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  middleName: Joi.string().allow(null, "").optional(),
  email: Joi.string().email().allow(null, "").optional(),
  phone: Joi.string().allow(null, "").optional(),
  department: optionalObjectId(objectId),
  position: optionalObjectId(objectId),
  academicTitle: optionalObjectId(objectId),
  active: Joi.boolean().optional(),
  passportSeria: Joi.string().allow(null, "").optional(),
  passportNumber: Joi.string().allow(null, "").optional(),
  googleScholar: Joi.string().allow(null, "").optional(),
  scopus: Joi.string().allow(null, "").optional(),
  photo: Joi.string().allow(null, "").optional(),
  degrees: Joi.object().optional(),

  jshshir: Joi.string()
    .pattern(/^\d{14}$/)
    .allow(null, "")
    .optional(),
  birthDate: Joi.date().allow(null).optional(),
  address: Joi.object({
    region: Joi.string().allow(null, "").optional(),
    district: Joi.string().allow(null, "").optional(),
    street: Joi.string().allow(null, "").optional(),
  }).optional(),
  employmentType: optionalEnum(
    Joi.string().valid("asosiy", "ichki_sovmestitel", "tashqi_sovmestitel", "soatbay"),
  ),

  teachingSpecialtyName: Joi.string().max(300).allow(null, "").optional(),
  teachingSpecialtyCode: Joi.string()
    .pattern(/^\d{2}\.\d{2}\.\d{2}$/)
    .allow(null, "")
    .optional(),
  teachingSpecialtyBasis: optionalEnum(
    Joi.string().valid(
      "diplom",
      "ordinatura",
      "sertifikat",
      "qayta_tayyorlash",
      "tajriba",
      "ilmiy_daraja",
    ),
  ),
  teachingSpecialtyNote: Joi.string().max(2000).allow(null, "").optional(),

  faculty: optionalObjectId(objectId),
};

const createSchema = Joi.object({
  ...staffFields,
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
});

const updateSchema = Joi.object(staffFields);

const listFilters = {
  search: Joi.string().allow("").optional(),
  faculty: optionalObjectId(objectId),
  department: optionalObjectId(objectId),
  position: optionalObjectId(objectId),
  active: Joi.boolean().optional(),
};

const findAll = Joi.object(listFilters);

const paginate = Joi.object({
  page: Joi.number().integer().required(),
  limit: Joi.number().integer().required(),
  ...listFilters,
});

const idSchema = Joi.object({
  id: objectId.required(),
});

module.exports = {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  idSchema,
};
