const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const courseInput = Joi.alternatives().try(
  Joi.number(),
  Joi.string().valid("all"),
  Joi.string().hex().length(24),
);

const baseStudent = {
  user: optionalObjectId(),
  fullName: Joi.string().max(300).optional(),
  passportSeria: Joi.string()
    .pattern(/^[A-Z]{2}$/)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base":
        "Pasport seriyasi 2 ta katta lotin harfi bo'lishi kerak (masalan: AB)",
    }),
  passportNumber: Joi.string()
    .pattern(/^[0-9]{7}$/)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base": "Pasport raqami 7 ta raqamdan iborat bo'lishi kerak",
    }),
  jshshir: Joi.string().allow(null, "").optional(),
  faculty: Joi.string().allow(null, "").optional(),
  direction: Joi.string().allow(null, "").optional(),
  course: courseInput.allow(null).optional(),
  group: Joi.string().allow(null, "").optional(),
  facultyId: optionalObjectId(),
  directionId: optionalObjectId(),
  groupId: optionalObjectId(),
  academicYear: Joi.string().allow(null, "").optional(),
  advisorId: Joi.string().allow(null, "").optional(),
  advisorName: Joi.string().allow(null, "").optional(),
  email: Joi.string().allow(null, "").optional(),
  phone: Joi.string().allow(null, "").optional(),
  workplace: Joi.string().allow(null, "").optional(),
  active: Joi.boolean().optional(),
};

const nameParts = {
  firstName: Joi.string().allow(null, "").optional(),
  lastName: Joi.string().allow(null, "").optional(),
  middleName: Joi.string().allow(null, "").optional(),
};

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

const passportPair = (value, helpers) => {
  if (filled(value.passportSeria) !== filled(value.passportNumber)) {
    return helpers.message(
      "Pasport seriyasi va raqami birga to'ldirilishi kerak (yoki ikkalasi ham bo'sh qoldirilsin)",
    );
  }
  return value;
};

const studentSchema = Joi.object({ ...baseStudent, ...nameParts })
  .or("fullName", "lastName")
  .custom(passportPair, "pasport juftligi");

const updateSchema = Joi.object(baseStudent)
  .fork(["fullName"], (s) => s.optional())
  .custom(passportPair, "pasport juftligi");

const importQuery = Joi.object({
  dryRun: Joi.boolean().optional(),
});

const templateQuery = Joi.object({
  sample: Joi.boolean().optional(),
});

const findAll = Joi.object({
  search: optionalString(Joi.string().trim()),
  faculty: optionalString(),
  course: courseInput.optional(),
  academicYear: optionalString(),
  active: Joi.boolean().optional(),
});

const paginate = findAll.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const readSchema = Joi.object({ id: Joi.string().required() });
const deleteSchema = Joi.object({ id: Joi.string().required() });

module.exports = {
  studentSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
  importQuery,
  templateQuery,
};
