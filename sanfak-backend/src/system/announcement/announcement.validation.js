const Joi = require("joi");
const { optionalEnum } = require("#validators/common");

const createAnnouncementSchema = Joi.object({
  title:             Joi.string().min(2).max(300).required(),
  body:              Joi.string().min(2).required(),
  module:            optionalEnum(
    Joi.string().valid("residency", "instituteCouncil", "scientificDept", "qualityAssurance", "general"),
  ),
  fileUrl:           Joi.string().uri().optional().allow(null, ""),
  targetCourses:     Joi.array().items(Joi.string()).optional(),
  targetDirections:  Joi.array().items(Joi.string()).optional(),
  targetUsers:       Joi.array().items(Joi.string()).optional(),
  expiresAt:         Joi.date().optional().allow(null),
});

const updateAnnouncementSchema = Joi.object({
  title:             Joi.string().min(2).max(300).optional(),
  body:              Joi.string().min(2).optional(),
  module:            optionalEnum(
    Joi.string().valid("residency", "instituteCouncil", "scientificDept", "qualityAssurance", "general"),
  ),
  fileUrl:           Joi.string().uri().optional().allow(null, ""),
  targetCourses:     Joi.array().items(Joi.string()).optional(),
  targetDirections:  Joi.array().items(Joi.string()).optional(),
  targetUsers:       Joi.array().items(Joi.string()).optional(),
  expiresAt:         Joi.date().optional().allow(null),
  active:            Joi.boolean().optional(),
});

module.exports = { createAnnouncementSchema, updateAnnouncementSchema };
