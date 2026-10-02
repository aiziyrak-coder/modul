const Joi = require("joi");
const {
  RESIDENT_PROGRAMS,
  FUNDING_TYPES,
  RESIDENT_STATUSES,
  STUDY_PERIOD_MIN,
  STUDY_PERIOD_MAX,
} = require("./resident.model");
const { optionalString, optionalObjectId, optionalNumber, optionalBoolean } = require("#validators/common");
const { PIN_RE } = require("#modules/4.05-residency/_services/residentAccount");

const objId = optionalObjectId();
const str = Joi.string().allow(null, "");

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

const passportPair = (value, helpers) => {
  if (filled(value.passportSeria) !== filled(value.passportNumber)) {
    return helpers.message(
      "Pasport seriyasi va raqami birga to'ldirilishi kerak (yoki ikkalasi ham bo'sh qoldirilsin)",
    );
  }
  return value;
};

const baseResidentSchema = Joi.object({
  user: objId.optional(),
  program: Joi.string()
    .valid(...RESIDENT_PROGRAMS)
    .required(),

  fullName: Joi.string().min(1).max(300).required(),
  jshshir: str.pattern(PIN_RE).optional().messages({
    "string.pattern.base": "JSHSHIR aniq 14 raqamdan iborat bo'lishi kerak",
  }),
  passportSeria: str.pattern(/^[A-Z]{2}$/).optional().messages({
    "string.pattern.base": "Pasport seriyasi 2 ta katta lotin harfi bo'lishi kerak (masalan: AB)",
  }),
  passportNumber: str.pattern(/^[0-9]{7}$/).optional().messages({
    "string.pattern.base": "Pasport raqami 7 ta raqamdan iborat bo'lishi kerak",
  }),
  address: str.optional(),
  workplace: str.optional(),
  workplaceLocation: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  })
    .allow(null)
    .optional(),
  email: str.email({ tlds: false }).optional().messages({
    "string.email": "E-pochta manzili noto'g'ri (masalan: ism@fjsti.uz)",
  }),
  phone: str.optional(),
  foreign: optionalBoolean(),

  fundingType: Joi.string()
    .valid(...FUNDING_TYPES)
    .allow(null, "")
    .optional(),
  studyPeriod: Joi.number()
    .integer()
    .min(STUDY_PERIOD_MIN)
    .max(STUDY_PERIOD_MAX)
    .allow(null)
    .optional(),
  academicYear: str.optional(),
  courseNumber: Joi.number().allow(null).optional(),
  admissionOrder: str.optional(),
  admissionDate: Joi.date().allow(null).optional(),

  specialty: objId.optional(),
  specialtyTitle: str.optional(),
  specialtyCode: str.optional(),
  department: objId.optional(),
  departmentTitle: str.optional(),
  group: objId.optional(),
  groupTitle: str.optional(),

  diplomaSeria: str.optional(),
  diplomaNumber: str.optional(),
  diplomaDate: Joi.date().allow(null).optional(),
  diplomaFileUrl: str.optional(),

  clinicalSkillsPlan: Joi.array()
    .items(
      Joi.object({
        skill: str,
        targetCount: optionalNumber(),
        completedCount: optionalNumber(),
      }),
    )
    .optional(),
});

const updateResidentSchema = baseResidentSchema
  .keys({
    firstName: str.optional(),
    lastName: str.optional(),
    middleName: str.optional(),
  })
  .fork(["program", "fullName"], (s) => s.optional())
  .custom(passportPair, "pasport juftligi");

const createResidentSchema = baseResidentSchema
  .keys({
    firstName: str.optional(),
    lastName: str.optional(),
    middleName: str.optional(),
  })
  .fork(["fullName"], (sc) => sc.optional())
  .or("fullName", "lastName")
  .custom(passportPair, "pasport juftligi");

const importQuery = Joi.object({
  dryRun: Joi.boolean().optional(),
});

const templateQuery = Joi.object({
  sample: Joi.boolean().optional(),
});

const assignSupervisorSchema = Joi.object({
  supervisor: Joi.string().required(),
  supervisorName: Joi.any().strip(),
  teachingLocation: str.optional(),
  practiceLocation: str.optional(),
  scheduleText: str.optional(),
  weeklyHours: Joi.number()
    .min(0)
    .max(60)
    .custom((value, helpers) =>
      Number.isInteger(value * 2) ? value : helpers.error("number.step"),
    )
    .messages({
      "number.step": '"weeklyHours" yarim soatlik qadam bilan berilishi kerak (0, 0.5, 1, 1.5 …)',
    })
    .allow(null)
    .optional(),
});

const listQuery = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  program: optionalString(Joi.string().valid(...RESIDENT_PROGRAMS)),
  fundingType: optionalString(Joi.string().valid(...FUNDING_TYPES)),
  courseNumber: optionalNumber(),
  specialty: optionalObjectId(),
  department: optionalObjectId(),
  group: optionalObjectId(),
  foreign: optionalBoolean(),
  academicYear: optionalString(),
  active: optionalBoolean(),
  status: optionalString(Joi.string().valid(...RESIDENT_STATUSES)),
});

const paginateQuery = listQuery.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const idSchema = Joi.object({
  id: Joi.string().required(),
});

const changeStatusSchema = Joi.object({
  status: Joi.string().valid("oquvda", "akademik_tatil").required().messages({
    "any.only":
      "Faqat 'oquvda' yoki 'akademik_tatil' tanlanadi. Chetlatish imzolangan buyruq (qog'oz + skan) orqali rasmiylashtiriladi.",
    "any.required": "Holat ko'rsatilishi shart",
  }),
  reason: Joi.string().trim().min(3).max(1000).required().messages({
    "any.required": "Sabab ko'rsatilishi shart",
    "string.min": "Sabab juda qisqa",
  }),
});

module.exports = {
  changeStatusSchema,
  createResidentSchema,
  importQuery,
  templateQuery,
  updateResidentSchema,
  assignSupervisorSchema,
  listQuery,
  paginateQuery,
  idSchema,
};
