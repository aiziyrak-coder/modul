const Joi = require("joi");
const { optionalObjectId } = require("#validators/common");

const objectId = Joi.string().hex().length(24);

const submitSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(200).required(),
  birthDate: Joi.date().max("now").required(),
  country: objectId.required().messages({
    "string.length": "Fuqarolik (davlat) ID noto'g'ri",
    "any.required": "Fuqarolikni tanlang",
  }),
  phone: Joi.string().trim().min(5).max(30).required(),
  parentPhone: Joi.string().trim().max(30).allow("", null),
  email: Joi.string().trim().email().max(120).required(),
  passportNumber: Joi.string().trim().min(4).max(50).required(),
  passportExpiry: Joi.date().greater("now").required(),

  direction: objectId.required(),
  educationForm: optionalObjectId(objectId),
  educationLanguage: optionalObjectId(objectId),

  offerAccepted: Joi.boolean().valid(true).required().messages({
    "any.only": "Ommaviy oferta shartlariga rozilik bildirilishi shart",
  }),
});

const languageQuery = Joi.object({
  language: Joi.string().valid("uz", "ru", "en").optional(),
});

const refQuery = languageQuery.keys({
  direction: Joi.string().hex().length(24).optional(),
});

const APP_NUMBER_PATTERN = /^APP-\d{4}-\d{5}$/;

const statusParams = Joi.object({
  applicationNumber: Joi.string()
    .trim()
    .pattern(APP_NUMBER_PATTERN)
    .required()
    .messages({ "string.pattern.base": "Ariza raqami APP-YYYY-NNNNN ko'rinishida bo'lishi kerak" }),
});

const statusLookupSchema = Joi.object({
  applicationNumber: Joi.string()
    .trim()
    .pattern(APP_NUMBER_PATTERN)
    .messages({ "string.pattern.base": "Ariza raqami APP-YYYY-NNNNN ko'rinishida bo'lishi kerak" }),
  country: objectId.messages({ "string.length": "Fuqarolik (davlat) ID noto'g'ri" }),
  passportNumber: Joi.string().trim().min(4).max(50),
})
  .or("applicationNumber", "passportNumber")
  .with("passportNumber", "country")
  .messages({
    "object.missing": "Ariza raqami yoki pasport ma'lumotlarini kiriting",
    "object.with": "Pasport bilan birga fuqarolikni ham tanlang",
  });

module.exports = { submitSchema, statusParams, statusLookupSchema, languageQuery, refQuery };
