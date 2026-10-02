const Joi = require("joi");
const { optionalString, optionalObjectId, optionalEnum } = require("#validators/common");

const STATUS = [
  "new",
  "in_progress",
  "done",
  "approved",
  "rejected",
  "overdue",
];

const taskSchema = Joi.object({
  title: Joi.string().required(),
  desc: Joi.string().allow("", null).optional(),
  assignee: Joi.string().required(),
  deadline: Joi.date().optional(),
  status: optionalEnum(Joi.string().valid(...STATUS)),
  active: Joi.boolean().optional(),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().optional(),
  desc: Joi.string().allow("", null).optional(),
  assignee: Joi.string().optional(),
  deadline: Joi.date().optional(),
  status: optionalEnum(Joi.string().valid(...STATUS)),
  active: Joi.boolean().optional(),
});

const submitResultSchema = Joi.object({
  resultFiles: Joi.array().items(Joi.string()).optional(),
  files: Joi.array().items(Joi.string()).optional(),
  media: Joi.any().optional(),
});

const rejectSchema = Joi.object({
  rejectReason: Joi.string().required(),
});

const findTasksSchema = Joi.object({
  search: optionalString(),
  status: optionalString(Joi.string().valid(...STATUS)),
  assignee: optionalObjectId(),
  deadlineFrom: Joi.date().optional(),
  deadlineTo: Joi.date().optional(),
});

const paginateTasksSchema = findTasksSchema.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

module.exports = {
  taskSchema,
  updateTaskSchema,
  submitResultSchema,
  rejectSchema,
  findTasksSchema,
  paginateTasksSchema,
};
