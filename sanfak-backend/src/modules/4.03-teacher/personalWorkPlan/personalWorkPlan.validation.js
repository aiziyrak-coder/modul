const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");
const { safeLink } = require("#modules/4.03-teacher/_shared/safeLink");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ObjectId formatida bo'lishi kerak");

const createWorkPlanSchema = Joi.object({
  teacher: optionalObjectId(objectId),
  academicYear: objectId.required(),
  semester: Joi.number().valid(1, 2).optional(),
  name: optionalString(),
});

const generateWorkPlanSchema = Joi.object({
  teacher: optionalObjectId(objectId),
  academicYear: objectId.required(),
  name: optionalString(),
});

const updateWorkPlanSchema = Joi.object({
  name: optionalString(),
  semester: Joi.number().valid(1, 2).optional(),
}).min(1);

const EDITABLE_SECTIONS = [
  "methodicalWork",
  "researchWork",
  "mentoringWork",
  "organizationalWork",
  "extraWork",
];

const activityItemFields = {
  title: Joi.string(),
  description: Joi.string().allow(null, ""),
  deadline: Joi.date().allow(null),
  plannedCount: Joi.number().min(0),
  actualCount: Joi.number().min(0),
  semester: Joi.array().items(Joi.number().valid(1, 2)),
  venue: Joi.string().allow(null, ""),
  note: Joi.string().allow(null, ""),
  fileUrl: Joi.string().allow(null, ""),
  link: Joi.string().allow(null, ""),
  studentName: Joi.string().allow(null, ""),
  topic: Joi.string().allow(null, ""),
  workType: Joi.string().allow(null, ""),
};

const activityItemSchema = Joi.object(activityItemFields).keys({
  title: Joi.string().required(),
});

const addActivitySchema = Joi.object({
  section: Joi.string()
    .valid(...EDITABLE_SECTIONS)
    .required(),
  item: activityItemSchema.required(),
});

const updateActivitySchema = Joi.object({
  section: Joi.string()
    .valid(...EDITABLE_SECTIONS)
    .required(),
  ...activityItemFields,
});

const completeActivitySchema = Joi.object({
  section: Joi.string()
    .valid(...EDITABLE_SECTIONS)
    .required(),
  fileUrl: safeLink(),
  link: safeLink(),
  actualCount: Joi.number().min(0).optional(),
});

const verifyActivitySchema = Joi.object({
  section: Joi.string()
    .valid(...EDITABLE_SECTIONS)
    .required(),
  decision: Joi.string().valid("approved", "rejected").required(),
  comment: Joi.string().when("decision", {
    is: "rejected",
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, "").optional(),
  }),
});

const completedItemsQuery = Joi.object({
  page: Joi.number().integer().optional(),
  limit: Joi.number().integer().optional(),
  search: Joi.string().allow("").optional(),
  academicYear: optionalObjectId(objectId),
  verificationStatus: optionalString(Joi.string().valid("pending", "approved", "rejected")),
  section: optionalString(Joi.string().valid(...EDITABLE_SECTIONS)),
});

const listFilters = {
  search: optionalString(),
  active: Joi.boolean().optional(),
  teacher: optionalObjectId(objectId),
  academicYear: optionalObjectId(objectId),
  status: optionalString(
    Joi.string().valid("draft", "submitted", "approved", "rejected"),
  ),
};

const findAll = Joi.object(listFilters);

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  ...listFilters,
});

const monitoring = Joi.object({
  teacher: optionalObjectId(objectId),
  academicYear: optionalObjectId(objectId),
  search: Joi.string().allow("").optional(),
  status: optionalString(
    Joi.string().valid("draft", "submitted", "approved", "rejected", "completed"),
  ),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
});

const monitoringExportQuery = monitoring.keys({
  format: Joi.string().valid("excel", "pdf").optional(),
  page: Joi.forbidden(),
  limit: Joi.forbidden(),
});

const readSchema = Joi.object({
  id: objectId.required(),
});

const deleteSchema = Joi.object({
  id: objectId.required(),
});

const activityParamsSchema = Joi.object({
  id: objectId.required(),
  activityId: objectId.required(),
});

const APPROVAL_STEP_KEYS = [
  "teacher",
  "kafedraUslubiy",
  "kafedraIlmiy",
  "kafedraUstozShogird",
  "kafedraMudiri",
  "oquvUslubiy",
  "dekan",
  "ichkiNazorat",
];

const approveWorkPlanSchema = Joi.object({
  comment: Joi.string().allow(null, "").optional(),
  step: Joi.string().valid(...APPROVAL_STEP_KEYS).optional(),
  eriSignature: Joi.string().allow(null, "").optional(),
  eriSerial: Joi.string().allow(null, "").optional(),
});

const rejectWorkPlanSchema = Joi.object({
  comment: Joi.string().required(),
  step: Joi.string().valid(...APPROVAL_STEP_KEYS).optional(),
});

module.exports = {
  createWorkPlanSchema,
  generateWorkPlanSchema,
  updateWorkPlanSchema,
  findAll,
  paginate,
  monitoring,
  monitoringExportQuery,
  readSchema,
  deleteSchema,
  activityParamsSchema,
  EDITABLE_SECTIONS,
  activityItemSchema,
  addActivitySchema,
  updateActivitySchema,
  completeActivitySchema,
  verifyActivitySchema,
  completedItemsQuery,
  APPROVAL_STEP_KEYS,
  approveWorkPlanSchema,
  rejectWorkPlanSchema,
};
