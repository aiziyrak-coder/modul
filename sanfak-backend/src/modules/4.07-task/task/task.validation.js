const Joi = require("joi");
const { optionalObjectId, optionalString } = require("#validators/common");

const {
  TASK_STATUSES: STATUSES,
  TASK_PRIORITIES: PRIORITIES,
  DISPLAY_STATUSES,
  FINALIZE_OUTCOMES,
} = require("#modules/4.07-task/task/task.model");

const createSchema = Joi.object({
  title: Joi.string().min(1).required(),
  description: Joi.string().allow("", null).optional(),
  deadline: Joi.date().required(),
  priority: Joi.string().valid(...PRIORITIES).optional(),
  category: optionalObjectId(),
  assignees: Joi.alternatives()
    .try(Joi.array().items(Joi.string()).min(1), Joi.string())
    .required(),
  attachments: Joi.array().optional(),
}).unknown(true);

const updateSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  description: Joi.string().allow("", null).optional(),
  deadline: Joi.date().optional(),
  priority: Joi.string().valid(...PRIORITIES).optional(),
  category: optionalObjectId(),
  attachments: Joi.array().optional(),
}).unknown(true);

const responseSchema = Joi.object({
  text: Joi.string().allow("", null).optional(),
  attachments: Joi.array().optional(),
  isCompleted: Joi.boolean().optional(),
  isRejected: Joi.boolean().optional(),
  isDeadlineChange: Joi.boolean().optional(),
  isReassign: Joi.boolean().optional(),
  rejectionReason: Joi.when("isRejected", {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("", null).optional(),
  }),
}).unknown(true);

const finalizeSchema = Joi.object({
  outcome: Joi.string().valid(...FINALIZE_OUTCOMES).required(),
});

const ALLOWED_STATUS_FILTERS = new Set(DISPLAY_STATUSES);
const statusFilter = Joi.string()
  .custom((value, helpers) => {
    const parts = String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return helpers.error("any.invalid");
    if (parts.some((p) => !ALLOWED_STATUS_FILTERS.has(p))) return helpers.error("any.invalid");
    if (parts.includes("overdue") && parts.length > 1) return helpers.error("any.invalid");
    return value;
  }, "status filtri")
  .optional();

const findAll = Joi.object({
  search: optionalString(),
  status: statusFilter,
  priority: Joi.string().valid(...PRIORITIES).optional(),
  category: optionalObjectId(),
  assignee: optionalObjectId(),
  deadlineFrom: Joi.date().optional(),
  deadlineTo: Joi.date().optional(),
  createdFrom: Joi.date().optional(),
  createdTo: Joi.date().optional(),
  sort: Joi.string().valid("deadline", "createdAt").optional(),
  order: Joi.string().valid("asc", "desc").optional(),
});

const paginate = findAll.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const responsesQuery = Joi.object({
  page: Joi.number().integer().optional(),
  limit: Joi.number().integer().optional(),
  order: Joi.string().valid("asc", "desc").optional(),
});

const monitoringQuery = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  search: Joi.string().allow("").optional(),
  sort: Joi.string()
    .valid("rating", "total", "completed", "active", "overdue", "name")
    .optional(),
  order: Joi.string().valid("asc", "desc").optional(),
  page: Joi.number().integer().optional(),
  limit: Joi.number().integer().optional(),
  assignee: optionalObjectId(),
});

const monthlyQuery = Joi.object({
  year: Joi.number().integer().optional(),
});

const statsQuery = Joi.object({
  search: optionalString(),
  priority: Joi.string().valid(...PRIORITIES).optional(),
  category: optionalObjectId(),
  assignee: optionalObjectId(),
  deadlineFrom: Joi.date().optional(),
  deadlineTo: Joi.date().optional(),
});

const assignableQuery = Joi.object({
  search: optionalString(),
  page: Joi.number().integer().optional(),
  limit: Joi.number().integer().optional(),
});

const idSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createSchema,
  updateSchema,
  responseSchema,
  finalizeSchema,
  findAll,
  paginate,
  responsesQuery,
  monitoringQuery,
  monthlyQuery,
  statsQuery,
  assignableQuery,
  idSchema,
};
