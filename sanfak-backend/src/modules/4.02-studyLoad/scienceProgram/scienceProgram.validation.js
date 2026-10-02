const Joi = require("joi");
const { academicYearInput } = require("#validators/common");

const {
  TOPIC_TYPES,
  EDUCATION_FORMS,
} = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const { PROTOCOL_RX } = require("#modules/4.02-studyLoad/_shared/protocolRx");

const topicSchema = Joi.object({
  order: Joi.number().optional(),
  title: Joi.string().required(),
  desc: Joi.string().allow(null, "").optional(),
});

const sectionSchema = Joi.object({
  title: Joi.string().allow(null, "").optional(),
  desc:  Joi.string().allow(null, "").optional(),
});

const hourItemSchema = Joi.object({
  slug:  Joi.string().allow("").optional(),
  title: Joi.string().allow("").optional(),
  value: Joi.number().min(0).default(0),
});

const literatureGroupSchema = Joi.object({
  slug:        Joi.string().allow("").optional(),
  title:       Joi.string().allow("", null).optional(),
  desc:        Joi.string().allow(null, "").optional(),
  literatures: Joi.array().items(Joi.string()).optional(),
});

const v142ProtocolSchema = Joi.object({
  date: Joi.date().allow(null).optional(),
  number: Joi.string()
    .trim()
    .max(20)
    .pattern(PROTOCOL_RX)
    .allow("", null)
    .optional()
    .messages({
      "string.pattern.base":
        "Bayonnoma raqami faqat raqam (ixtiyoriy '/' yoki '-' bilan qism) bo'lishi kerak, masalan: 6 yoki 3/2026",
      "string.max": "Bayonnoma raqami 20 belgidan oshmasin",
    }),
});

const v142PersonSchema = Joi.object({
  fio: Joi.string().trim().max(200).required().messages({
    "any.required": "F.I.O majburiy",
    "string.empty": "F.I.O majburiy",
  }),
  degree:     Joi.string().max(100).allow(null, "").optional(),
  title:      Joi.string().max(100).allow(null, "").optional(),
  department: Joi.string().max(200).allow(null, "").optional(),
  position:   Joi.string().max(200).allow(null, "").optional(),
});

const v142CodeTextSchema = Joi.object({
  code: Joi.string().max(20).allow(null, "").optional(),
  text: Joi.string().max(2000).required().messages({
    "any.required": "Ta'lim natijasi matni majburiy",
    "string.empty": "Ta'lim natijasi matni majburiy",
  }),
});

const v142TopicSchema = Joi.object({
  type: Joi.string()
    .valid(...TOPIC_TYPES)
    .required()
    .messages({
      "any.only": `Mashg'ulot turi quyidagilardan biri bo'lishi kerak: ${TOPIC_TYPES.join(", ")}`,
      "any.required": "Mashg'ulot turi majburiy",
    }),
  code:  Joi.string().max(8).allow(null, "").optional(),
  title: Joi.string().max(2000).required().messages({
    "any.required": "Mavzu nomi majburiy",
    "string.empty": "Mavzu nomi majburiy",
  }),
  hours: Joi.number().integer().min(0).max(999).default(0).messages({
    "number.min": "Mavzu soati manfiy bo'lishi mumkin emas",
    "number.max": "Mavzu soati 999 dan oshmasin",
  }),
  refs: Joi.array().items(Joi.number().integer().min(1)).max(20).optional(),
});

const v142Schema = Joi.object({
  educationForm: Joi.string()
    .valid(...EDUCATION_FORMS)
    .optional()
    .messages({
      "any.only": `Ta'lim shakli quyidagilardan biri bo'lishi kerak: ${EDUCATION_FORMS.join(", ")}`,
    }),

  prerequisites: Joi.array()
    .items(
      Joi.object({
        code:  Joi.string().max(20).allow(null, "").optional(),
        title: Joi.string().max(500).required().messages({
          "any.required": "Fan nomi majburiy",
          "string.empty": "Fan nomi majburiy",
        }),
      }),
    )
    .max(50)
    .optional(),

  outcomes: Joi.object({
    competencies: Joi.array().items(v142CodeTextSchema).max(50).optional(),
    skills:       Joi.array().items(v142CodeTextSchema).max(50).optional(),
  }).optional(),

  topics: Joi.array().items(v142TopicSchema).max(300).optional(),

  independentTasks: Joi.array()
    .items(
      Joi.object({
        order: Joi.number().integer().min(0).max(999).optional(),
        title: Joi.string().max(2000).required().messages({
          "any.required": "Topshiriq mavzusi majburiy",
          "string.empty": "Topshiriq mavzusi majburiy",
        }),
        hours: Joi.number().integer().min(0).max(999).optional(),
      }),
    )
    .max(50)
    .optional(),
  independentNote: Joi.string().allow(null, "").max(2000).optional(),

  techMethods: Joi.array().items(Joi.string().max(500)).max(30).optional(),

  grading: Joi.object({
    a: Joi.array().items(Joi.string().max(500)).max(30).optional(),
    b: Joi.array().items(Joi.string().max(500)).max(30).optional(),
    d: Joi.array().items(Joi.string().max(500)).max(30).optional(),
    e: Joi.array().items(Joi.string().max(500)).max(30).optional(),
  }).optional(),

  authors:   Joi.array().items(v142PersonSchema).max(20).optional(),
  reviewers: Joi.array().items(v142PersonSchema).max(20).optional(),
  councilProtocol:    v142ProtocolSchema.optional(),
  departmentProtocol: v142ProtocolSchema.optional(),
});

const createscienceProgramSchema = Joi.object({
  science: Joi.string().required(),
  directions: Joi.array().items(Joi.string()).optional(),

  formVersion: Joi.string().valid("v259", "v142").optional(),

  knowledgeArea: Joi.array().items(Joi.string()).optional(),
  educationArea: Joi.array().items(Joi.string()).optional(),

  code: Joi.string().allow(null, "").optional(),
  serialNumber: Joi.string().allow(null, "").optional(),
  academicYear: academicYearInput.allow(null, "").optional(),
  semester: Joi.string().allow(null, "").optional(),
  credits: Joi.number().allow(null).optional(),
  moduleType: Joi.string().allow(null, "").optional(),
  language: Joi.string().allow(null, "").optional(),
  weeklyHours: Joi.number().allow(null).optional(),
  classroomHours: Joi.number().allow(null).optional(),
  independentHours: Joi.number().allow(null).optional(),
  totalHours: Joi.number().allow(null).optional(),

  hourItems: Joi.array().items(hourItemSchema).optional(),
  lectureHours:   Joi.number().allow(null).optional(),
  seminarHours:   Joi.number().allow(null).optional(),
  labHours:       Joi.number().allow(null).optional(),
  practicalHours: Joi.number().allow(null).optional(),

  sciencePurpose: Joi.object({
    desc: Joi.string().allow(null, "").optional(),
  }).optional(),
  scienceTasks: Joi.object({
    desc: Joi.string().allow(null, "").optional(),
  }).optional(),

  title: Joi.string().allow(null, "").optional(),
  desc: Joi.string().allow(null, "").optional(),
  topics: Joi.array().items(topicSchema).optional(),

  seminarRecommendation: sectionSchema.allow(null).optional(),
  independentTask: sectionSchema.allow(null).optional(),
  learningOutcome: Joi.object({
    desc: Joi.string().allow(null, "").optional(),
  })
    .allow(null)
    .optional(),
  teachingMethods: sectionSchema.allow(null).optional(),
  creditRequirements: sectionSchema.allow(null).optional(),

  literatureGroups:     Joi.array().items(literatureGroupSchema).optional(),
  guidanceLiterature:   sectionSchema.allow(null).optional(),
  primaryLiterature:    sectionSchema.allow(null).optional(),
  additionalLiterature: sectionSchema.allow(null).optional(),
  informationSource:    sectionSchema.allow(null).optional(),

  approval_info: Joi.string().allow(null, "").optional(),
  responsible: sectionSchema.allow(null).optional(),
  reviewer: sectionSchema.allow(null).optional(),

  v142: Joi.when("formVersion", {
    is: "v142",
    then: v142Schema.optional(),
    otherwise: Joi.any().forbidden().messages({
      "any.unknown":
        "v142 bo'limi faqat 142-son shaklidagi fan dasturida yuboriladi (formVersion: \"v142\")",
    }),
  }),
});

const updatescienceProgramSchema = createscienceProgramSchema
  .fork(["science"], (f) => f.optional())
  .fork(["formVersion"], () => Joi.any().forbidden())
  .fork(["v142"], () => v142Schema.optional());


const approveScienceProgramSchema = Joi.object({
  protocol: Joi.string()
    .trim()
    .max(20)
    .pattern(PROTOCOL_RX)
    .optional()
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Bayonnoma raqami faqat raqam (ixtiyoriy '/' yoki '-' bilan qism) bo'lishi kerak, masalan: 12 yoki 3/2026",
      "string.max": "Bayonnoma raqami 20 belgidan oshmasin",
    }),
  signature:    Joi.string().optional().allow("", null),
  eriSignature: Joi.string().optional().allow("", null),
  eriSerial:    Joi.string().optional().allow("", null),
});
module.exports = {
  createscienceProgramSchema,
  updatescienceProgramSchema,
  approveScienceProgramSchema,
  v142Schema,
  PROTOCOL_RX,
};
