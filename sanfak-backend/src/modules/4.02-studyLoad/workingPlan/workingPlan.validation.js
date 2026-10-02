const Joi = require("joi");
const {
  MAX_ALTERNATIVES,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");

const createWorkingPlanSchema = Joi.object({
  studyPlan: Joi.string().required(),
  department: Joi.string().required(),
  academicYear: Joi.string().optional(),
  semester: Joi.number().optional(),
});

const electiveUsageQuerySchema = Joi.object({
  semKey: Joi.string().required(),
  parentId: Joi.string().required(),
  _id: Joi.string().required(),
  year: Joi.number().integer().min(1).optional(),
});

const alternativeItemSchema = Joi.object({
  scienceId: Joi.string().required(),
});

const alternativesSchema = Joi.array()
  .items(alternativeItemSchema)
  .max(MAX_ALTERNATIVES);

const swapElectiveScienceSchema = Joi.object({
  semKey: Joi.string().required(),
  parentId: Joi.string().required(),
  _id: Joi.string().required(),
  scienceId: Joi.string().required(),
  alternatives: alternativesSchema.optional(),
});

const setElectiveAlternativesSchema = Joi.object({
  semKey: Joi.string().required(),
  blockId: Joi.string().required(),
  scienceRowId: Joi.string().required(),
  alternatives: alternativesSchema.required(),
});

const workingPlanParticleItemSchema = Joi.object({
  _id: Joi.string().allow("", null).optional(),
}).pattern(Joi.string(), Joi.number());

const assessmentTypeRefSchema = Joi.string()
  .hex()
  .length(24)
  .allow("", null)
  .optional()
  .messages({
    "string.hex": "evaluationType — assessmentType ma'lumotnomasining _id si bo'lishi kerak",
    "string.length": "evaluationType — assessmentType ma'lumotnomasining _id si bo'lishi kerak",
  });

const smesterSchema = Joi.object({
  totalCredit: Joi.number().optional(),
  weeklyHours: Joi.number().optional(),
  evaluationType: assessmentTypeRefSchema,
});

const updateWorkingPlanScienceSchema = Joi.object({
  semKey: Joi.string().required(),
  parentId: Joi.string().required(),
  _id: Joi.string().required(),

  particle: Joi.array().items(workingPlanParticleItemSchema).optional(),
  smester: smesterSchema.optional(),

  serialNumber: Joi.string().allow("", null).optional(),
  code: Joi.string().allow("", null).optional(),
  title: Joi.string().allow("", null).optional(),
  totalCredit: Joi.number().optional(),
  weeklyHours: Joi.number().optional(),
  evaluationType: assessmentTypeRefSchema,
});

module.exports = {
  createWorkingPlanSchema,
  swapElectiveScienceSchema,
  electiveUsageQuerySchema,
  alternativesSchema,
  setElectiveAlternativesSchema,
  updateWorkingPlanScienceSchema,
};
