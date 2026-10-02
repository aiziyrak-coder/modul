const Joi = require("joi");
const {
  academicYearField,
  mediaField,
} = require("#modules/4.10-scientificDept/_shared/achievement.validation");

const PATENT_TYPES = ["invention", "utilityModel", "industrialDesign", "selection"];

const createPatentSchema = Joi.object({
  title: Joi.string().trim().min(2).max(500).required(),
  patentType: Joi.string()
    .valid(...PATENT_TYPES)
    .optional()
    .allow(null),
  registrationNumber: Joi.string().trim().allow("").max(100).optional(),
  date: Joi.date().optional(),
  academicYear: academicYearField.optional(),
  media: mediaField,
});

const updatePatentSchema = Joi.object({
  title: Joi.string().trim().min(2).max(500),
  patentType: Joi.string().valid(...PATENT_TYPES).allow(null),
  registrationNumber: Joi.string().trim().allow("").max(100),
  date: Joi.date(),
  academicYear: academicYearField,
  media: mediaField,
}).min(1);

module.exports = { PATENT_TYPES, createPatentSchema, updatePatentSchema };
