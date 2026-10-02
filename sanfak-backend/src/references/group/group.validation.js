const Joi = require("joi");
const {
  multiLangSchema,
  multiLangOptional,
  optionalObjectId,
} = require("#validators/common");

const objectIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("lang field ObjectId formatida bo'lishi kerak (LanguageOfInstruction _id)");

const academicYearSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("academicYear field ObjectId formatida bo'lishi kerak (AcademicYear _id)");

const createGroupSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  direction: Joi.string().optional(),
  course: Joi.string().optional(),
  lang: optionalObjectId(objectIdSchema),
  studentNumber: Joi.number().optional(),
  academicYear: optionalObjectId(academicYearSchema),
  active: Joi.boolean().optional(),
});

const updateGroupGroupSchema = Joi.object({
  title: multiLangSchema.optional(),
  desc: multiLangOptional.optional(),
  direction: Joi.string().optional(),
  course: Joi.string().optional(),
  lang: optionalObjectId(objectIdSchema),
  studentNumber: Joi.number().optional(),
  academicYear: optionalObjectId(academicYearSchema),
  active: Joi.boolean().optional(),
});

module.exports = { createGroupSchema, updateGroupGroupSchema };
