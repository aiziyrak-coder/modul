const Joi = require("joi");

const topicSchema = Joi.object({
  topic: Joi.string().optional().allow(null, ""),
  hour: Joi.number().min(0).default(0),
});

const hourItemSchema = Joi.object({
  slug:  Joi.string().optional().allow(""),
  title: Joi.string().optional().allow(""),
  value: Joi.number().min(0).default(0),
});

const gradingCriterionSchema = Joi.object({
  slug:  Joi.string().optional().allow(""),
  title: Joi.string().optional().allow("", null),
  desc:  Joi.string().optional().allow(null, ""),
});

const literatureGroupSchema = Joi.object({
  slug:        Joi.string().optional().allow(""),
  title:       Joi.string().optional().allow("", null),
  literatures: Joi.array().items(Joi.string()).optional(),
});

const createSyllabusSchema = Joi.object({
  science: Joi.string().required(),
  faculty: Joi.string().optional().allow(null, ""),

  scienceProgram: Joi.string().required().messages({
    "any.required": "Fan dasturini tanlang — sillabus fan dasturisiz yaratilmaydi",
    "string.empty": "Fan dasturini tanlang — sillabus fan dasturisiz yaratilmaydi",
  }),
  directions: Joi.array().items(Joi.string()).optional(),
  scienceTitle: Joi.string().optional().allow(null, ""),
  scienceType: Joi.string().optional().allow(null, ""),
  scienceCode: Joi.string().optional().allow(null, ""),
  year: Joi.number().integer().min(1).optional(),
  semester: Joi.number().integer().min(1).max(12).optional(),
  educationForm: Joi.string().optional().allow(null, ""),
  credits: Joi.number().min(0).optional(),
  evaluationForm: Joi.string().optional().allow(null, ""),
  scienceLang: Joi.string().optional().allow(null, ""),

  hoursByType: Joi.object({
    title:      Joi.string().optional().allow(null, ""),
    totalHours: Joi.number().min(0).optional(),
    items:      Joi.array().items(hourItemSchema).optional(),
    lecture:     Joi.number().min(0).optional(),
    practical:   Joi.number().min(0).optional(),
    laboratory:  Joi.number().min(0).optional(),
    seminar:     Joi.number().min(0).optional(),
    independent: Joi.number().min(0).optional(),
  }).optional(),

  sciencePurpose: Joi.object({
    desc: Joi.string().optional().allow(null, ""),
  }).optional(),

  prerequisiteKnowledge: Joi.object({
    desc: Joi.string().optional().allow(null, ""),
  }).optional(),

  learningOutcome: Joi.object({
    knowledgeOutcomes: Joi.array().items(Joi.string()).optional(),
    skillOutcomes: Joi.array().items(Joi.string()).optional(),
  }).optional(),

  scienceContent: Joi.object({
    desc: Joi.string().optional().allow(null, ""),
    topics: Joi.array().items(topicSchema).optional(),
  }).optional(),

  trainingSeminar: Joi.object({
    topics: Joi.array().items(topicSchema).optional(),
  }).optional(),

  independent: Joi.object({
    topics: Joi.array().items(topicSchema).optional(),
  }).optional(),

  literatureGroups: Joi.array().items(literatureGroupSchema).optional(),
  primaryLiterature: Joi.object({
    title: Joi.string().optional().allow(null, ""),
    literatures: Joi.array().items(Joi.string()).optional(),
  }).optional().allow(null),
  additionalLiterature: Joi.object({
    title: Joi.string().optional().allow(null, ""),
    literatures: Joi.array().items(Joi.string()).optional(),
  }).optional().allow(null),

  evaluationCriteria: Joi.object({
    title:    Joi.string().optional().allow(null, ""),
    criteria: Joi.array().items(gradingCriterionSchema).optional(),
    grading_5: Joi.object({ title: Joi.string().optional().allow(null, ""), desc: Joi.string().optional().allow(null, "") }).optional(),
    grading_4: Joi.object({ title: Joi.string().optional().allow(null, ""), desc: Joi.string().optional().allow(null, "") }).optional(),
    grading_3: Joi.object({ title: Joi.string().optional().allow(null, ""), desc: Joi.string().optional().allow(null, "") }).optional(),
    grading_2: Joi.object({ title: Joi.string().optional().allow(null, ""), desc: Joi.string().optional().allow(null, "") }).optional(),
  }).optional(),

  author: Joi.object({
    teacher: Joi.string().optional().allow(null, ""),
    email: Joi.string().email({ tlds: { allow: false } }).optional().allow(null, ""),
    organization: Joi.string().optional().allow(null, ""),
    reviewer: Joi.object({
      desc: Joi.string().optional().allow(null, ""),
    }).optional().allow(null),
  }).optional(),

  desc: Joi.string().optional().allow(null, ""),

  weeklySchedule: Joi.object({
    title: Joi.string().optional().allow(null, ""),
    weeks: Joi.array().items(Joi.object({
      week:  Joi.number().integer().min(1).optional(),
      topic: Joi.string().optional().allow(null, ""),
      type:  Joi.string().optional().allow(null, ""),
      hour:  Joi.number().min(0).default(0),
    })).optional(),
  }).optional(),

  submissionRules: Joi.object({
    title: Joi.string().optional().allow(null, ""),
    desc:  Joi.string().optional().allow(null, ""),
  }).optional(),

  contactInfo: Joi.object({
    title:    Joi.string().optional().allow(null, ""),
    schedule: Joi.string().optional().allow(null, ""),
    room:     Joi.string().optional().allow(null, ""),
    phone:    Joi.string().optional().allow(null, ""),
    desc:     Joi.string().optional().allow(null, ""),
  }).optional(),

  confirmation: Joi.object({
    viceRector: Joi.string().optional().allow(null, ""),
    signature: Joi.string().optional().allow(null, ""),
    date: Joi.string().optional().allow(null, ""),
  }).optional(),

  methodicalHead: Joi.object({
    leader: Joi.string().optional().allow(null, ""),
    signature: Joi.string().optional().allow(null, ""),
    date: Joi.string().optional().allow(null, ""),
  }).optional(),

  facultyDean: Joi.object({
    dean: Joi.string().optional().allow(null, ""),
    signature: Joi.string().optional().allow(null, ""),
    date: Joi.string().optional().allow(null, ""),
  }).optional(),

  departmentHead: Joi.object({
    manager: Joi.string().optional().allow(null, ""),
    signature: Joi.string().optional().allow(null, ""),
    date: Joi.string().optional().allow(null, ""),
  }).optional(),

  creator: Joi.object({
    teacher: Joi.string().optional().allow(null, ""),
    signature: Joi.string().optional().allow(null, ""),
    date: Joi.string().optional().allow(null, ""),
  }).optional(),

  finalize: Joi.boolean().optional(),
});

const updateSyllabusSchema = createSyllabusSchema
  .fork(["science", "faculty"], (f) => f.optional())
  .fork(["scienceProgram"], (f) => f.optional().allow(null, ""));

const { PROTOCOL_RX } = require("#modules/4.02-studyLoad/_shared/protocolRx");

const approveSyllabusSchema = Joi.object({
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

module.exports = { approveSyllabusSchema, createSyllabusSchema, updateSyllabusSchema };
