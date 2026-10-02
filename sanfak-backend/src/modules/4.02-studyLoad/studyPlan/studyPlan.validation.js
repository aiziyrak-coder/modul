const Joi = require("joi");
const {
  MAX_ALTERNATIVES,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");

const createStudyPlanSchema = Joi.object({
  direction: Joi.string().required(),
  academicYear: Joi.string().required(),
  semester: Joi.number().optional(),
  sciences: Joi.array().optional(),
  fileUrl: Joi.string().optional(),
});

const particleItemSchema = Joi.object({
  _id: Joi.string().optional(),
  slug: Joi.string().allow("", null).optional(),
  slugRef: Joi.string().allow(null).optional(),
  title: Joi.string().allow("", null).optional(),
  value: Joi.number().optional(),
  canonical: Joi.string().allow("", null).optional(),
  colNum: Joi.number().allow(null).optional(),
});

const semesterSchema = Joi.object({
  hour: Joi.number().optional(),
  credit: Joi.number().optional(),
  particles: Joi.array().items(particleItemSchema).optional(),
  weeklyHours: Joi.number().optional(),
  assessmentType: Joi.string().allow("", null).optional(),
});

const updateStudyPlanScienceSchema = Joi.object({
  blockCode: Joi.string().required(),
  scienceCode: Joi.string().required(),

  serialNumber: Joi.string().allow("", null).optional(),
  code: Joi.string().allow("", null).optional(),
  title: Joi.string().allow("", null).optional(),
  totalCredit: Joi.number().optional(),
  particle: Joi.array().items(particleItemSchema).optional(),
  semesters: Joi.object().pattern(/^\d+$/, semesterSchema).optional(),
})
  .or(
    "serialNumber",
    "code",
    "title",
    "totalCredit",
    "particle",
    "semesters",
  );

const alternativeItemSchema = Joi.object({
  scienceId: Joi.string().required(),
});

const alternativesSchema = Joi.array()
  .items(alternativeItemSchema)
  .max(MAX_ALTERNATIVES);

const linkStudyPlanScienceSchema = Joi.object({
  blockCode: Joi.string().required(),
  scienceCode: Joi.string().required(),
  scienceId: Joi.string().required(),
});

const electiveRowSemesterSchema = Joi.object({
  semester: Joi.string()
    .pattern(/^\d+$/)
    .required(),
  hour: Joi.number().greater(0).required().messages({
    "number.greater": "Har semestrda soat 0 dan katta bo'lishi shart",
    "any.required": "Har semestrda soat majburiy",
  }),
  credit: Joi.number().greater(0).required().messages({
    "number.greater": "Har semestrda kredit 0 dan katta bo'lishi shart",
    "any.required": "Har semestrda kredit majburiy",
  }),
  particle: Joi.array().items(particleItemSchema).optional(),
});

const addElectiveRowSchema = Joi.object({
  blockCode: Joi.string().required(),
  science: Joi.string().hex().length(24).required(),
  serialNumber: Joi.string().allow("", null).optional(),
  semesters: Joi.array().items(electiveRowSemesterSchema).min(1).required(),
  alternatives: alternativesSchema.optional(),
});

const electiveRowParamsSchema = Joi.object({
  id: Joi.string().required(),
  rowId: Joi.string().required(),
});

module.exports = {
  createStudyPlanSchema,
  updateStudyPlanScienceSchema,
  alternativesSchema,
  linkStudyPlanScienceSchema,
  addElectiveRowSchema,
  electiveRowParamsSchema,
};
