const Joi = require("joi");
const {
  academicYearField,
  mediaField,
} = require("#modules/4.10-scientificDept/_shared/achievement.validation");

const TITLE_TYPES = ["dotsent", "professor"];

const createTitleSchema = Joi.object({
  titleType: Joi.string().trim().min(1).max(200).required(),
  specialty: Joi.string().trim().min(2).max(500).required(),
  diplomaSeries: Joi.string().trim().min(1).max(50).required(),
  diplomaNumber: Joi.string().trim().min(1).max(50).required(),
  date: Joi.date().optional(),
  academicYear: academicYearField.optional(),
  media: mediaField,
});

const updateTitleSchema = Joi.object({
  titleType: Joi.string().trim().min(1).max(200),
  specialty: Joi.string().trim().min(2).max(500),
  diplomaSeries: Joi.string().trim().min(1).max(50),
  diplomaNumber: Joi.string().trim().min(1).max(50),
  date: Joi.date(),
  academicYear: academicYearField,
  media: mediaField,
}).min(1);

module.exports = { TITLE_TYPES, createTitleSchema, updateTitleSchema };
