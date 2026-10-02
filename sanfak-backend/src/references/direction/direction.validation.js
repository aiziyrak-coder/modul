const Joi = require("joi");
const { optionalObjectId } = require("#validators/common");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = Joi.string()
  .pattern(objectIdRegex)
  .message("Noto'g'ri ObjectId format");

const teachingLanguagesSchema = Joi.array()
  .items(objectIdSchema)
  .min(1)
  .unique();

const areaSchema = Joi.string().trim().max(300).allow(null, "").optional();

const createDirectionSchema = Joi.object({
  title: Joi.string().min(1).required(),
  desc: Joi.string().allow(null, "").optional(),
  directionCode: Joi.string().trim().min(1).required().messages({
    "any.required": "Yo'nalish kodi majburiy (masalan: 60910200)",
    "string.empty": "Yo'nalish kodi majburiy (masalan: 60910200)",
  }),
  level: optionalObjectId(objectIdSchema),
  readingFormat: optionalObjectId(objectIdSchema),
  educationForm: optionalObjectId(objectIdSchema),
  specialization: optionalObjectId(objectIdSchema),
  faculty: optionalObjectId(objectIdSchema),
  practiceDepartment: optionalObjectId(objectIdSchema),
  knowledgeArea: areaSchema,
  educationArea: areaSchema,
  studyPeriod: Joi.number().optional(),
  international: Joi.boolean().optional(),
  teachingLanguages: teachingLanguagesSchema.optional(),
  active: Joi.boolean().optional(),
});

const updateDirectionSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  desc: Joi.string().allow(null, "").optional(),
  directionCode: Joi.string().allow(null, "").optional(),
  level: optionalObjectId(objectIdSchema),
  readingFormat: optionalObjectId(objectIdSchema),
  educationForm: optionalObjectId(objectIdSchema),
  specialization: optionalObjectId(objectIdSchema),
  faculty: optionalObjectId(objectIdSchema),
  practiceDepartment: optionalObjectId(objectIdSchema),
  knowledgeArea: areaSchema,
  educationArea: areaSchema,
  studyPeriod: Joi.number().optional(),
  international: Joi.boolean().optional(),
  teachingLanguages: teachingLanguagesSchema.optional(),
  active: Joi.boolean().optional(),
});

module.exports = {
  createDirectionSchema,
  updateDirectionSchema,
};
