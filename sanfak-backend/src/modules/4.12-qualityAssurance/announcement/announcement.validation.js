const Joi = require("joi");

const announcementSchema = Joi.object({
  title: Joi.string().min(1).max(300).required(),
  content: Joi.string().min(1).max(10000).required(),
});

const announcementUpdateSchema = Joi.object({
  title: Joi.string().min(1).max(300).optional(),
  content: Joi.string().min(1).max(10000).optional(),
  active: Joi.boolean().optional(),
});

module.exports = { announcementSchema, announcementUpdateSchema };
