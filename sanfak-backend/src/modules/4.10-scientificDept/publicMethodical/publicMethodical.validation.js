const Joi = require("joi");

const submitSchema = Joi.object({
  title: Joi.string().trim().min(3).max(300).required().messages({
    "any.required": "Mavzu kiritilishi shart",
    "string.min": "Mavzu juda qisqa",
    "string.max": "Mavzu 300 belgidan oshmasligi kerak",
  }),

  specialty: Joi.string().hex().length(24).required().messages({
    "any.required": "Ixtisoslik tanlanishi shart",
    "string.length": "Ixtisoslik noto'g'ri tanlangan",
  }),

  academicYear: Joi.string()
    .trim()
    .pattern(/^\d{4}\/\d{4}$/)
    .required()
    .messages({
      "any.required": "O'quv yili tanlanishi shart",
      "string.pattern.base": "O'quv yili YYYY/YYYY ko'rinishida bo'lishi kerak",
    }),

  authorName: Joi.string().trim().min(3).max(120).required().messages({
    "any.required": "F.I.Sh. kiritilishi shart",
    "string.min": "F.I.Sh. juda qisqa",
  }),

  authorPhone: Joi.string().trim().min(7).max(30).required().messages({
    "any.required": "Telefon raqami kiritilishi shart",
    "string.min": "Telefon raqami juda qisqa",
  }),

  organization: Joi.string().trim().min(3).max(200).required().messages({
    "any.required": "Ish joyi (OTM) kiritilishi shart",
  }),

  departmentName: Joi.string().trim().max(200).allow("", null).optional(),
  authorEmail: Joi.string().trim().email().max(120).allow("", null).optional().messages({
    "string.email": "E-pochta noto'g'ri kiritilgan",
  }),
});

module.exports = { submitSchema };
