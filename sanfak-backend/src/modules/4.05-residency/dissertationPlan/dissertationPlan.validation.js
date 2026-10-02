const Joi = require("joi");
const {
  DISSERTATION_STAGES,
  PLAN_STATUSES,
} = require("#modules/4.05-residency/_services/workPlanSchemas");
const { optionalString, optionalObjectId, optionalNumber } = require("#validators/common");
const {
  planDueDate,
  proofWorkDate,
} = require("#modules/4.05-residency/_services/dateBounds");

const taskItem = Joi.object({
  category: Joi.string()
    .valid(...DISSERTATION_STAGES)
    .required(),
  title: Joi.string().min(1).required(),
  targetCount: optionalNumber(Joi.number().integer().min(1)),
  dueDate: planDueDate().allow(null).optional(),
});

const createSchema = Joi.object({
  resident: optionalObjectId(),
  title: Joi.string().min(1).required(),
  academicYear: Joi.string().allow("", null).optional(),
  tasks: Joi.array().items(taskItem).optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  academicYear: Joi.string().allow("", null).optional(),
  tasks: Joi.array().items(taskItem).optional(),
});

const approveSchema = Joi.object({
  eriKey: Joi.string().allow("", null).optional(),
  eriSignature: Joi.string().allow("", null).optional(),
  eriData: Joi.string().allow("", null).optional(),
});
const rejectSchema = Joi.object({
  reason: Joi.string().min(1).required(),
});
const proofSchema = Joi.object({
  fileUrl: Joi.string().allow("", null).optional(),
  url: Joi.string().allow("", null).optional(),
  comment: Joi.string().allow("", null).optional(),
  workDate: proofWorkDate().optional(),
});
const reviewProofSchema = Joi.object({
  decision: Joi.string().valid("approved", "rejected").required(),

  comment: Joi.string()
    .max(1000)
    .when("decision", {
      is: "rejected",
      then: Joi.string().trim().min(1).required().messages({
        "any.required": "Qaytarish sababi majburiy",
        "string.empty": "Qaytarish sababi majburiy",
      }),
      otherwise: Joi.optional().allow("", null),
    }),
});

const listQuery = Joi.object({
  status: Joi.string()
    .valid(...PLAN_STATUSES)
    .optional(),
  academicYear: optionalString(),
  resident: optionalObjectId(),
  search: Joi.string().allow("").optional(),
  page: optionalNumber(Joi.number().integer()),
  limit: optionalNumber(Joi.number().integer()),
});

const idSchema = Joi.object({ id: Joi.string().required() });
const taskParam = Joi.object({
  id: Joi.string().required(),
  taskIndex: Joi.number().integer().min(0).required(),
});
const proofParam = Joi.object({
  id: Joi.string().required(),
  taskIndex: Joi.number().integer().min(0).required(),
  proofIndex: Joi.number().integer().min(0).required(),
});

module.exports = {
  createSchema,
  updateSchema,
  approveSchema,
  rejectSchema,
  proofSchema,
  reviewProofSchema,
  listQuery,
  idSchema,
  taskParam,
  proofParam,
};
