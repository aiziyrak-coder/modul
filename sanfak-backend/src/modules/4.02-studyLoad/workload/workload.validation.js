const Joi = require("joi");
const { optionalString } = require("#validators/common");

const academicYearInput = Joi.alternatives().try(
  Joi.string().hex().length(24),
  Joi.string().pattern(/^\d{4}\s*[-/]\s*\d{4}$/),
);

const createWorkloadSchema = Joi.object({
  department: Joi.string().required(),
  academicYear: academicYearInput.required(),
  semester: Joi.number().optional(),
  science: Joi.string().required(),
  direction: optionalString(),
  course: optionalString(),
  hours: Joi.object().optional(),
});

const updateWorkloadSchema = Joi.object({
  title: Joi.string().optional().allow(null, ""),
  comment: Joi.string().optional().allow(null, ""),
  date: Joi.string().optional().allow(null, ""),
}).min(1);

const objectId = Joi.string().hex().length(24);

const classTypeEditSchema = Joi.object({
  _id: objectId.required(),
  stream: Joi.number().min(0).required(),
});

const workItemEditSchema = Joi.object({
  _id: objectId.required(),
  value: Joi.number().min(0).required(),
});

const updateBlockContentSchema = Joi.object({
  studyWork: Joi.object({
    classTypes: Joi.array().items(classTypeEditSchema).min(1).optional(),
    items: Joi.array().items(workItemEditSchema).min(1).optional(),
  }).optional(),
  otherWork: Joi.object({
    items: Joi.array().items(workItemEditSchema).min(1).optional(),
  }).optional(),
  leadership: Joi.number().min(0).optional(),
}).min(1);

const updateBlockContentParamsSchema = Joi.object({
  id: Joi.string().required(),
  blockId: Joi.string().required(),
});

const STAFF_POSITION_CATEGORY_SLUGS = Object.freeze({
  departmentHead: ["professor", "docent", "seniorTeacher"],
  teachingStaff: [
    "professor",
    "docent",
    "seniorTeacher",
    "assistant",
    "trainee",
  ],
  supportStaff: ["seniorLaborant", "laborant", "cabinetHead"],
});

const staffPositionItemEditSchema = Joi.object({
  _id: objectId.optional(),
  category: Joi.string()
    .valid(...Object.keys(STAFF_POSITION_CATEGORY_SLUGS))
    .required(),
  slug: Joi.string().required(),
  positions: Joi.number().min(0).required(),
  load: Joi.number().min(0).required(),
  hourly: Joi.number().min(0).optional(),
})
  .custom((value, helpers) => {
    const allowedSlugs = STAFF_POSITION_CATEGORY_SLUGS[value.category] || [];
    if (!allowedSlugs.includes(value.slug)) {
      return helpers.message(
        `"${value.slug}" — "${value.category}" kategoriyasi uchun ruxsat etilgan lavozim emas`,
      );
    }
    return value;
  }, "category-slug juftligi tekshiruvi");

const updateStaffPositionsSchema = Joi.object({
  items: Joi.array().items(staffPositionItemEditSchema).min(1).required(),
}).min(1);

const summaryXlsxQuery = Joi.object({
  academicYear: academicYearInput.required(),
});

module.exports = {
  summaryXlsxQuery,
  createWorkloadSchema,
  updateWorkloadSchema,
  updateBlockContentSchema,
  updateBlockContentParamsSchema,
  updateStaffPositionsSchema,
  STAFF_POSITION_CATEGORY_SLUGS,
  academicYearInput,
};
