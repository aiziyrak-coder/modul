const Joi = require("joi");

const { optionalString, optionalObjectId, optionalEnum } = require("#validators/common");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ObjectId formatida bo'lishi kerak");

const url = Joi.string().uri().allow(null, "");
const language = optionalString(Joi.string().valid("uz", "ru", "eng"));

const profileFields = {
  department: optionalObjectId(objectId),
  faculty: optionalObjectId(objectId),
  position: optionalObjectId(objectId),
  employmentType: optionalEnum(
    Joi.string().valid("asosiy", "ichki_sovmestitel", "tashqi_sovmestitel", "soatbay"),
  ),

  education: Joi.array().optional(),
  academicDegree: Joi.string().allow(null, "").optional(),
  academicTitle: Joi.string().allow(null, "").optional(),

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

  photo: Joi.string().allow(null, "").optional(),

  contactInfo: Joi.object().optional(),

  googleScholarUrl: url.optional(),
  scopusUrl: url.optional(),
  orcidUrl: url.optional(),
  hIndex: Joi.number().min(0).optional(),
};

const createProfileSchema = Joi.object({
  ...profileFields,
});

const updateProfileSchema = Joi.object(profileFields);

const listFilters = {
  search: optionalString(),
  hrApprovalStatus: optionalString(Joi.string().valid("pending", "approved", "rejected")),
  department: optionalObjectId(objectId),
  faculty: optionalObjectId(objectId),
  user: optionalObjectId(objectId),
  active: Joi.boolean().optional(),
  language,
};

const findAll = Joi.object(listFilters);

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  ...listFilters,
});

const readSchema = Joi.object({
  id: objectId.required(),
  language,
});

const deleteSchema = Joi.object({
  id: objectId.required(),
});

const DEGREE_TYPES = [
  "bachelorDegree",
  "masterDegree",
  "scientificDegree",
  "scientificTitle",
];

const uploadMyDegreesSchema = Joi.object({
  degrees: Joi.object(
    Object.fromEntries(
      DEGREE_TYPES.map((t) => [
        t,
        Joi.array().items(
          Joi.object({
            title: Joi.string().required(),
            path: Joi.string().required(),
          }),
        ),
      ]),
    ),
  ).optional(),
}).unknown(true);

const deleteMyDegreeSchema = Joi.object({
  type: Joi.string()
    .valid(...DEGREE_TYPES)
    .required(),
  fileId: objectId.required(),
});

module.exports = {
  createProfileSchema,
  updateProfileSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
  DEGREE_TYPES,
  uploadMyDegreesSchema,
  deleteMyDegreeSchema,
};
