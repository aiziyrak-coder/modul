const Joi = require("joi");
const { optionalString } = require("#validators/common");

const updateLearningProcessSchema = Joi.object({
  title: optionalString(Joi.string().min(10).max(300)),
  status: Joi.string().valid("new", "created").optional(),
  comment: Joi.string().allow(null, "").optional(),
  active: Joi.boolean().optional(),
  basisNote: Joi.string().allow(null, "").max(500).optional(),
}).options({ allowUnknown: true });

const updateSpecialPartsSchema = Joi.object({
  comment: Joi.string().allow(null, "").optional(),
  learningProcess: Joi.object({
    keys: Joi.array()
      .items(
        Joi.object({
          _id: Joi.string().required(),
          week: Joi.number().optional(),
          semester: Joi.string().optional().allow(null, ""),
          title: Joi.string().optional().allow(null, ""),
        }),
      )
      .optional(),
    title: Joi.string().optional().allow(null, ""),
  }).optional(),
});

const updateSpecialPartsTitleSchema = Joi.object({
  learningProcess: Joi.object({
    title: Joi.string().optional().allow(null, ""),
  }).optional(),
});

const createLearningProcessSchema = Joi.object({
  planSource: Joi.string().optional(),
  basisNote: Joi.when("planSource", {
    is: "ministry",
    then: Joi.string().trim().min(1).required().messages({
      "any.required": "Vazirlik rejasida asos izohi majburiy",
      "string.empty": "Vazirlik rejasida asos izohi majburiy",
    }),
    otherwise: Joi.string().allow(null, "").optional(),
  }),
}).options({ allowUnknown: true });

const monthWeeksSchema = Joi.object({
  counts: Joi.array()
    .items(
      Joi.object({
        month: Joi.string().trim().min(1).max(20).required(),
        count: Joi.number().integer().min(1).max(52).required(),
      }),
    )
    .min(1)
    .max(12)
    .required(),
  applyToDraftSchedules: Joi.boolean().default(true),
});

module.exports = {
  updateLearningProcessSchema,
  updateSpecialPartsSchema,
  updateSpecialPartsTitleSchema,
  createLearningProcessSchema,
  monthWeeksSchema,
};
