const Joi = require("joi");
const {
  multiLangSchema,
  findAll,
  paginate,
  optionalObjectId,
  optionalEnum,
} = require("#validators/common");

const externalAuthorSchema = Joi.object({
  name: Joi.string().required(),
  workplace: Joi.string().required(),
  position: Joi.string().required(),
  passportSeries: Joi.string().allow("", null),
  passportNumber: Joi.string().allow("", null),
  pinfl: Joi.string().allow("", null),
  email: Joi.string().email({ tlds: { allow: false } }).allow("", null),
  phone: Joi.string().max(32).allow("", null),
});

const supervisorSchema = Joi.object({
  type: Joi.string().valid("internal", "external").default("internal"),
  user: Joi.string().when("type", {
    is: "internal",
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null).empty(""),
  }),
  name: Joi.string().when("type", {
    is: "external",
    then: Joi.string().required(),
    otherwise: Joi.string().allow("", null),
  }),
  workplace: Joi.string().when("type", {
    is: "external",
    then: Joi.string().required(),
    otherwise: Joi.string().allow("", null),
  }),
  position: Joi.string().when("type", {
    is: "external",
    then: Joi.string().required(),
    otherwise: Joi.string().allow("", null),
  }),
  academicTitle: Joi.string().allow("", null),
  degree: Joi.string().allow("", null),
  email: Joi.string().email({ tlds: { allow: false } }).allow("", null),
  phone: Joi.string().max(32).allow("", null),
});

const createWorkSchema = Joi.object({
  title: multiLangSchema.required(),
  titleRu: Joi.string().allow("", null),
  year: Joi.string().allow("", null),
  authorType: optionalEnum(Joi.string().valid("internal", "external")).default("internal"),
  researcher: Joi.string().allow(null).empty(""),
  specialty: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null).empty(""),
  externalAuthor: Joi.when("authorType", {
    is: "external",
    then: externalAuthorSchema.required(),
    otherwise: Joi.any().strip(),
  }),
  supervisor: supervisorSchema.optional(),
  type: Joi.string().allow("", null),
  councilMembers: Joi.array().items(Joi.string()).optional(),
});

const updateWorkSchema = Joi.object({
  title: Joi.string().allow("", null),
  titleRu: Joi.string().allow("", null),
  year: Joi.string().allow("", null),
  authorType: Joi.string().valid("internal", "external"),
  researcher: optionalObjectId(),
  specialty: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null).empty(""),
  externalAuthor: externalAuthorSchema.optional(),
  supervisor: supervisorSchema.optional(),
  type: Joi.string().allow("", null),
  active: Joi.boolean().optional(),
});

const updateSeminarResultSchema = Joi.object({
  seminarResult: Joi.string()
    .valid("defended", "not_defended")
    .allow(null)
    .required(),
  defenseDate: Joi.date().allow(null).optional(),
});

const updateDefenseResultSchema = Joi.object({
  defenseResult: Joi.string()
    .valid("defended", "not_defended")
    .allow(null)
    .required(),
});

const changeStatusSchema = Joi.object({
  status: Joi.string()
    .valid("new", "pending", "reviewed", "not_evaluated", "not_recommended", "rejected", "revision")
    .required(),
});

const updateMembersSchema = Joi.object({
  memberIds: Joi.array().items(Joi.string()).required(),
});

const updateDocAssignmentsSchema = Joi.object({
  assignments: Joi.object().pattern(
    Joi.string(),
    Joi.array().items(Joi.string()),
  ).required(),
});

const generateProtocolSchema = Joi.object({
  finalConclusion: Joi.string().optional(),
  conclusion: Joi.string().optional(),
  intro: Joi.string().allow("").optional(),
}).or("finalConclusion", "conclusion");

const updateSeminarDateSchema = Joi.object({
  seminarDate: Joi.date().allow(null).required(),
});

const updateDefenseDateSchema = Joi.object({
  defenseDate: Joi.date().allow(null).required(),
});

const makeDecisionSchema = Joi.object({
  type: Joi.string().valid("seminar", "revision", "rejected").required(),
  comment: Joi.string().allow("", null),
  revisionDocs: Joi.array().items(Joi.string()).optional(),
  seminarDate: Joi.date().optional(),
  rejectionReason: Joi.string().allow("", null),
}).when(".type", {
  is: "rejected",
  then: Joi.object({
    rejectionReason: Joi.string().min(1).required(),
  }),
});

const memberDecisionSchema = Joi.object({
  type: Joi.string().valid("revision", "rejected").required(),
  comment: Joi.string().allow("", null),
  revisionDocs: Joi.array().items(Joi.string()).optional(),
  rejectionReason: Joi.string().allow("", null),
}).when(".type", {
  is: "rejected",
  then: Joi.object({
    rejectionReason: Joi.string().min(1).required(),
  }),
});

const acceptApplicationSchema = Joi.object({
  memberIds: Joi.array().items(Joi.string()).min(1).required(),
});

const uploadDocumentSchema = Joi.object({
  docKey: Joi.string().required(),
  fileName: Joi.string().required(),
});

const STEPS = ["works", "seminars", "defenses"];

const findAllWorksQuery = findAll.keys({
  memberId: optionalObjectId(),
  step: Joi.string().valid(...STEPS).optional(),
  defenseResult: Joi.string().valid("defended", "not_defended").optional(),
  specialty: optionalObjectId(),
  councilNumber: optionalObjectId(),
});

const paginateWorksQuery = paginate.keys({
  memberId: optionalObjectId(),
  step: Joi.string().valid(...STEPS).optional(),
  defenseResult: Joi.string().valid("defended", "not_defended").optional(),
  specialty: optionalObjectId(),
  councilNumber: optionalObjectId(),
});

module.exports = {
  findAllWorksQuery,
  paginateWorksQuery,
  createWorkSchema,
  updateWorkSchema,
  changeStatusSchema,
  updateSeminarResultSchema,
  updateSeminarDateSchema,
  updateDefenseDateSchema,
  updateDefenseResultSchema,
  updateMembersSchema,
  updateDocAssignmentsSchema,
  generateProtocolSchema,
  makeDecisionSchema,
  memberDecisionSchema,
  acceptApplicationSchema,
  uploadDocumentSchema,
};
