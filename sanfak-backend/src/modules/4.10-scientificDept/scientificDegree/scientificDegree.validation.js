const Joi = require("joi");
const {
  academicYearField,
  mediaField,
} = require("#modules/4.10-scientificDept/_shared/achievement.validation");

const DEGREE_TYPES = ["phd", "dsc"];

const createDegreeSchema = Joi.object({
  degreeType: Joi.string().trim().min(1).max(200).required(),
  specialty: Joi.string().trim().min(2).max(500).required(),
  dissertationTopic: Joi.string().trim().min(2).max(1000).required(),
  awardedDate: Joi.date().optional(),
  defenseDate: Joi.date().required(),
  councilName: Joi.string().trim().min(2).max(500).required(),
  councilNumber: Joi.string().trim().min(1).max(100).required(),
  academicYear: academicYearField.optional(),
  media: mediaField,
  fileSlots: Joi.string().optional(),
});

const updateDegreeSchema = Joi.object({
  degreeType: Joi.string().trim().min(1).max(200),
  specialty: Joi.string().trim().min(2).max(500),
  dissertationTopic: Joi.string().trim().min(2).max(1000),
  awardedDate: Joi.date(),
  defenseDate: Joi.date(),
  councilName: Joi.string().trim().min(2).max(500),
  councilNumber: Joi.string().trim().min(1).max(100),
  academicYear: academicYearField,
  fileSlots: Joi.string(),
  media: mediaField,
}).min(1);

module.exports = { DEGREE_TYPES, createDegreeSchema, updateDegreeSchema };
