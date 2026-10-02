const Joi = require("joi");
const {
  academicYearField,
  mediaField,
} = require("#modules/4.10-scientificDept/_shared/achievement.validation");

const createCopyrightSchema = Joi.object({
  title: Joi.string().trim().min(2).max(500).required(),
  authors: Joi.string().trim().allow("").max(1000).optional(),
  institutionName: Joi.string().trim().allow("").max(500).optional(),
  registrationNumber: Joi.string().trim().allow("").max(100).optional(),
  date: Joi.date().optional(),
  academicYear: academicYearField.optional(),
  media: mediaField,
});

const updateCopyrightSchema = Joi.object({
  title: Joi.string().trim().min(2).max(500),
  authors: Joi.string().trim().allow("").max(1000),
  institutionName: Joi.string().trim().allow("").max(500),
  registrationNumber: Joi.string().trim().allow("").max(100),
  date: Joi.date(),
  academicYear: academicYearField,
  media: mediaField,
}).min(1);

module.exports = { createCopyrightSchema, updateCopyrightSchema };
