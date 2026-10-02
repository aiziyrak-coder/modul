const Joi = require("joi");

const submitSchema = Joi.object({
  name: Joi.string().trim().min(3).max(200).required().messages({
    "any.required": "F.I.Sh. kiritilishi shart",
    "string.min": "F.I.Sh. juda qisqa",
  }),

  specialization: Joi.string().trim().min(1).max(50).required().messages({
    "any.required": "Mutaxassislik (ixtisoslik shifri) tanlanishi shart",
  }),

  course: Joi.number().integer().min(1).max(10).optional().allow("", null),

  university: Joi.string().trim().min(2).max(200).required().messages({
    "any.required": "OTM nomi kiritilishi shart",
  }),

  phone: Joi.string().trim().min(5).max(30).required().messages({
    "any.required": "Telefon raqami kiritilishi shart",
  }),
});

module.exports = { submitSchema };
