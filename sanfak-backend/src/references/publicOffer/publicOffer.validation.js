const Joi = require("joi");

const sectionSchema = Joi.object({
  order: Joi.number().integer().min(0).required(),
  title: Joi.string().min(3).max(500).required(),
  comment: Joi.string().min(3).required(),
});

const createPublicOfferSchema = Joi.object({
  sections: Joi.array().items(sectionSchema).min(1).required(),
});

const updatePublicOfferSchema = Joi.object({
  sections: Joi.array().items(sectionSchema).min(1).optional(),
  active: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    "object.min": "Kamida bitta field yangilash uchun berilishi kerak",
  });

module.exports = {
  createPublicOfferSchema,
  updatePublicOfferSchema,
};
