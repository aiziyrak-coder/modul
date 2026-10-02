const Joi = require("joi");
const {
  academicYearField,
  mediaField,
} = require("#modules/4.10-scientificDept/_shared/achievement.validation");

const createDefenseSchema = Joi.object({
  degreeType: Joi.string().trim().min(1).max(200).required(),
  scienceBranch: Joi.string().trim().min(2).max(300).required(),
  specialty: Joi.string().trim().min(2).max(500).required(),
  diplomaSeries: Joi.string().trim().max(100).optional().allow(""),
  diplomaNumber: Joi.string().trim().max(100).optional().allow(""),
  defenseDate: Joi.date().required(),
  councilName: Joi.string().trim().min(2).max(500).required(),
  councilNumber: Joi.string().trim().min(1).max(100).required(),
  academicYear: academicYearField.optional(),
  media: mediaField,
  fileSlots: Joi.string().optional(),
});

const updateDefenseSchema = Joi.object({
  degreeType: Joi.string().trim().min(1).max(200),
  scienceBranch: Joi.string().trim().min(2).max(300),
  specialty: Joi.string().trim().min(2).max(500),
  diplomaSeries: Joi.string().trim().max(100).allow(""),
  diplomaNumber: Joi.string().trim().max(100).allow(""),
  defenseDate: Joi.date(),
  councilName: Joi.string().trim().min(2).max(500),
  councilNumber: Joi.string().trim().min(1).max(100),
  academicYear: academicYearField,
  media: mediaField,
  fileSlots: Joi.string(),
}).min(1);

module.exports = { createDefenseSchema, updateDefenseSchema };
