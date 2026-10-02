const Joi = require("joi");
const { MODULES, ACTIONS } = require("#config/constants");

const validSections = Object.values(MODULES);
const validActions = Object.values(ACTIONS);

const SECTION_ALIASES = {
  schoolYear: "academicYear",
  curriculum: "studyPlan",
  scienceProgramm: "scienceProgram",
  scientificProgram: "scienceProgram",
};

const sectionSchema = Joi.string()
  .custom((value, helpers) => {
    const normalized = SECTION_ALIASES[value] || value;
    if (!validSections.includes(normalized)) {
      return helpers.error("any.invalid", { value });
    }
    return normalized;
  })
  .required()
  .messages({
    "any.invalid":
      'Noto\'g\'ri section nomi: "{#value}". Mavjud sectionlar (98 ta): ' +
      validSections.join(", "),
    "string.empty": "section bo'sh bo'lishi mumkin emas",
    "any.required": "section majburiy",
  });

const actionKeySchema = Joi.string()
  .valid(...validActions)
  .messages({
    "any.only":
      'Noto\'g\'ri action: "{#value}". Mavjud actionlar: ' +
      validActions.join(", "),
  });

const permissionItemSchema = Joi.object({
  section: sectionSchema,
  actionKeys: Joi.array().items(actionKeySchema).default([]),
});

const roleSchema = Joi.object({
  title: Joi.string().required(),
  desc: Joi.string().optional().allow(""),
  permissions: Joi.array().items(permissionItemSchema).default([]),
  scopeLevel: Joi.string()
    .valid("global", "faculty", "department", "self")
    .optional()
    .default("self"),
  isSystem: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
});

const readSchema = Joi.object({
  id: Joi.string().required(),
});

const updateSchema = Joi.object({
  title: Joi.string().optional(),
  desc: Joi.string().optional().allow(""),
  permissions: Joi.array().items(permissionItemSchema),
  scopeLevel: Joi.string()
    .valid("global", "faculty", "department", "self")
    .optional(),
  isSystem: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
});

const deleteSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  roleSchema,
  readSchema,
  updateSchema,
  deleteSchema,
  SECTION_ALIASES,
};
