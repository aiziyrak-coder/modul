const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const achievementFields = {
  documentType: Joi.string(),
  title: Joi.string().allow(""),
  desc: Joi.string().allow("", null),
  fileUrl: Joi.string().allow(""),
  fileName: Joi.string().allow(""),
  link: Joi.string()
    .uri({ scheme: ["http", "https"] })
    .max(2000)
    .allow("")
    .messages({
      "string.uriCustomScheme": "Havola http:// yoki https:// bilan boshlanishi kerak",
      "string.uri": "Havola http:// yoki https:// bilan boshlanishi kerak",
      "string.max": "Havola juda uzun (ko'pi bilan 2000 belgi)",
    }),
};

const achievementSchema = Joi.object({
  ...achievementFields,
  student: optionalObjectId(),
  documentType: Joi.string().required(),
});

const updateSchema = Joi.object(achievementFields);

const myUpdateSchema = Joi.object(achievementFields);

const reviewSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
  score: Joi.number().min(0).optional(),
  scoreCriteria: optionalObjectId(),
  scoreCategoryId: Joi.string().allow(null, "").optional(),
  scoreLabel: Joi.string().allow(null, "").optional(),
  reviewNote: Joi.string()
    .max(1000)
    .when("status", {
      is: "rejected",
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ""),
    }),
});

const findAll = Joi.object({
  search: optionalString(Joi.string().trim()),
  status: optionalString(Joi.string().valid("pending", "approved", "rejected")),
  active: Joi.boolean().optional(),
});

const readSchema = Joi.object({ id: Joi.string().required() });
const deleteSchema = Joi.object({ id: Joi.string().required() });

module.exports = {
  achievementSchema,
  updateSchema,
  myUpdateSchema,
  reviewSchema,
  findAll,
  readSchema,
  deleteSchema,
};
