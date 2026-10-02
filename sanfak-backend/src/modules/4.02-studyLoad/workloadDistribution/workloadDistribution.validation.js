const Joi = require("joi");
const { optionalObjectId, optionalString } = require("#validators/common");

const objectId = Joi.string().hex().length(24);

const ASSIGNMENT_BASES = [
  "kafedrada_mutaxassis_yoq",
  "ish_tajribasi",
  "oqigan_fani_yaqin",
  "sertifikat_malaka",
  "ilmiy_ishlar",
  "boshqa",
];

const suitabilityBasis = optionalString(
  Joi.string().valid(...ASSIGNMENT_BASES),
);

const suitabilityNote = Joi.string()
  .trim()
  .max(2000)
  .when("suitabilityBasis", {
    is: "boshqa",
    then: Joi.string().min(30).required(),
    otherwise: Joi.string()
      .min(10)
      .when("suitabilityBasis", {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional().allow(null, ""),
      }),
  });

const createDistributionSchema = Joi.object({
  workload: Joi.string().required().messages({
    "any.required": "workload id majburiy",
    "string.base":  "workload id string bo'lishi kerak",
  }),
  date: Joi.string().optional().allow("", null),
});

const streamSchema = Joi.object({
  number:   Joi.number().integer().min(1).required(),
  groups:   Joi.array().items(objectId).min(1).required(),
  language: optionalObjectId(objectId),
});

const addBlockToTeacherSchema = Joi.object({
  workloadBlockId: objectId.required().messages({
    "any.required": "workloadBlockId majburiy",
  }),
  semester: Joi.number().valid(1, 2).optional(),
  subGroup: Joi.number().integer().min(0).optional(),
  groups:   Joi.array().items(objectId).optional(),
  streams:  Joi.array().items(streamSchema).optional(),
  classTypeSlugs: Joi.array()
    .items(Joi.string().trim().max(50))
    .unique()
    .max(10)
    .optional(),
  suitabilityBasis,
  suitabilityNote,
});

const updateBlockHoursSchema = Joi.object({
  totalHour: Joi.number().min(0).required().messages({
    "any.required": "totalHour majburiy",
    "number.min": "totalHour manfiy bo'lishi mumkin emas",
  }),
});

const addTeacherSchema = Joi.object({
  teacher: optionalObjectId(objectId),
  stavka: Joi.number().min(0).max(2).optional(),
  position: Joi.string().max(200).optional().allow(null, ""),
  specialization: Joi.string().max(200).optional().allow(null, ""),
  phone: Joi.string().max(50).optional().allow(null, ""),
  isVacant: Joi.boolean().optional(),
  vacantLabel: Joi.string().max(200).optional().allow(null, ""),
  vacancyReason: Joi.string().max(1000).optional().allow(null, ""),
  vacancy: Joi.object({
    requiredPosition: Joi.string().max(200).optional().allow(null, ""),
    requiredSpecialization: Joi.string().max(200).optional().allow(null, ""),
    requiredAcademicTitle: Joi.string()
      .valid("phd", "docent", "professor")
      .optional()
      .allow(null, ""),
    deadline: Joi.date().optional().allow(null),
  }).optional(),
})
  .custom((value, helpers) => {
    if (!value.isVacant && !value.teacher) {
      return helpers.error("any.custom", {
        message: "isVacant=false bo'lsa teacher majburiy",
      });
    }
    return value;
  });

const vacateTeacherSchema = Joi.object({
  reason: Joi.string().max(1000).optional().allow(null, ""),
  requiredPosition: Joi.string().max(200).optional().allow(null, ""),
  requiredSpecialization: Joi.string().max(200).optional().allow(null, ""),
  requiredAcademicTitle: Joi.string()
    .valid("phd", "docent", "professor")
    .optional()
    .allow(null, ""),
  deadline: Joi.date().optional().allow(null),
});

const updateDistributionSchema = Joi.object({
  title: Joi.string().optional().allow(null, ""),
  course: Joi.number().integer().min(0).optional(),
  comment: Joi.string().optional().allow(null, ""),
  date: Joi.string().optional().allow(null, ""),
}).min(1);

const fillVacancySchema = Joi.object({
  teacher: objectId.required().messages({
    "any.required": "teacher id majburiy",
  }),
  position: Joi.string().max(200).optional().allow(null, ""),
  specialization: Joi.string().max(200).optional().allow(null, ""),
  phone: Joi.string().max(50).optional().allow(null, ""),
  stavka: Joi.number().min(0).max(2).optional(),
  suitabilityBasis,
  suitabilityNote,
});

const respondSchema = Joi.object({
  action: Joi.string().valid("accepted", "rejected").required().messages({
    "any.required": "action majburiy",
    "any.only": "action faqat 'accepted' yoki 'rejected' bo'lishi mumkin",
  }),
  reason: Joi.string()
    .trim()
    .min(1)
    .when("action", {
      is: "rejected",
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ""),
    })
    .messages({
      "string.empty": "Rad etish uchun reason (asos) majburiy",
      "any.required": "Rad etish uchun reason (asos) majburiy",
    }),
  blockIds: Joi.array().items(objectId).min(1).max(100).unique().optional(),
});

const respondParamsSchema = Joi.object({
  id: objectId.required(),
  teacherEntryId: objectId.required(),
});

const electiveOptionsQuerySchema = Joi.object({
  blockId: objectId.required().messages({
    "any.required": "blockId majburiy",
    "string.length": "blockId 24 belgili ObjectId bo'lishi kerak",
    "string.hex": "blockId 24 belgili ObjectId bo'lishi kerak",
  }),
});

const electiveChoiceSchema = Joi.object({
  blockId: objectId.required().messages({
    "any.required": "blockId majburiy",
  }),
  scienceId: objectId.required().messages({
    "any.required": "scienceId majburiy",
  }),
  suitabilityBasis,
  suitabilityNote,
});

module.exports = {
  createDistributionSchema,
  ASSIGNMENT_BASES,
  electiveOptionsQuerySchema,
  electiveChoiceSchema,
  updateDistributionSchema,
  addBlockToTeacherSchema,
  updateBlockHoursSchema,
  addTeacherSchema,
  vacateTeacherSchema,
  fillVacancySchema,
  respondSchema,
  respondParamsSchema,
  streamSchema,
};
