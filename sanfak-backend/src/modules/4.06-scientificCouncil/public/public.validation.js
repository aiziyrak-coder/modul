const Joi = require("joi");

const YEAR_FORMAT = /^\d{4}-\d{4}$/;
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const PHONE = /^[+]?[\d\s()-]{7,25}$/;

const email = Joi.string()
  .trim()
  .max(120)
  .email({ tlds: { allow: false } });

const required = (max) => Joi.string().trim().min(2).max(max).required();
const optional = (max) => Joi.string().trim().max(max).allow("", null);

const submitSchema = Joi.object({
  title: Joi.string().trim().min(5).max(500).required().messages({
    "any.required": "Ilmiy ish nomi majburiy",
    "string.min": "Ilmiy ish nomi juda qisqa",
  }),
  specialty: Joi.string().regex(OBJECT_ID).required().messages({
    "any.required": "Ixtisoslik tanlanmagan",
    "string.pattern.base": "Ixtisoslik noto'g'ri",
  }),
  year: Joi.string().regex(YEAR_FORMAT).required().messages({
    "any.required": "O'quv yili majburiy",
    "string.pattern.base": "O'quv yili formati noto'g'ri (masalan: 2025-2026)",
  }),

  fullName: required(200).messages({ "any.required": "F.I.Sh majburiy" }),
  workplace: required(300).messages({ "any.required": "Ish joyi majburiy" }),
  position: required(200).messages({ "any.required": "Lavozim majburiy" }),
  passportSeries: Joi.string()
    .trim()
    .uppercase()
    .regex(/^[A-Za-zА-Яа-я]{2}$/)
    .required()
    .messages({
      "any.required": "Pasport seriyasi majburiy",
      "string.pattern.base": "Pasport seriyasi ikki harfdan iborat (masalan: AA)",
    }),
  passportNumber: Joi.string()
    .trim()
    .regex(/^\d{7}$/)
    .required()
    .messages({
      "any.required": "Pasport raqami majburiy",
      "string.pattern.base": "Pasport raqami 7 ta raqamdan iborat",
    }),
  pinfl: Joi.string()
    .trim()
    .regex(/^\d{14}$/)
    .required()
    .messages({
      "any.required": "JSHSHIR majburiy",
      "string.pattern.base": "JSHSHIR 14 ta raqamdan iborat",
    }),
  phone: Joi.string().trim().regex(PHONE).required().messages({
    "any.required": "Telefon raqami majburiy",
    "string.pattern.base": "Telefon raqami noto'g'ri",
  }),
  email: email.required().messages({
    "any.required": "Elektron pochta majburiy",
    "string.email": "Elektron pochta noto'g'ri",
  }),

  supervisorName: required(200).messages({
    "any.required": "Ilmiy rahbarning F.I.Sh majburiy",
  }),
  supervisorWorkplace: required(300).messages({
    "any.required": "Ilmiy rahbarning ish joyi majburiy",
  }),
  supervisorPosition: required(200).messages({
    "any.required": "Ilmiy rahbarning lavozimi majburiy",
  }),
  supervisorAcademicTitle: optional(150),
  supervisorDegree: optional(150),
  supervisorEmail: email.allow("", null),
  supervisorPhone: Joi.string().trim().regex(PHONE).allow("", null).messages({
    "string.pattern.base": "Ilmiy rahbarning telefon raqami noto'g'ri",
  }),
});

module.exports = { submitSchema, YEAR_FORMAT, PHONE };
