const Joi = require("joi");
const {
  optionalString,
  optionalObjectId,
  optionalNumber,
} = require("#validators/common");
const { planDueDate } = require("#modules/4.05-residency/_services/dateBounds");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");
const TYPES = ["ochiq_dars", "dars_kuzatish"];
const PLAN_KINDS = ["activity", "dissertation"];

const attendee = Joi.object({ user: objectId.required() });

const base = {
  resident: optionalObjectId(objectId),
  type: Joi.string().valid(...TYPES),
  date: planDueDate(),
  room: optionalObjectId(objectId),
  topic: Joi.string().max(500).allow("", null),
  attendees: Joi.array().items(attendee).max(50),
  plan: optionalObjectId(objectId),
  planKind: optionalString(Joi.string().valid(...PLAN_KINDS)),
  taskTitle: Joi.string().max(500).allow("", null),
  note: Joi.string().max(2000).allow("", null),
  academicYear: Joi.string().allow("", null),
};

exports.createSchema = Joi.object({
  ...base,
  resident: objectId.required(),
  type: base.type.required(),
  date: base.date.required(),
});

exports.updateSchema = Joi.object({
  type: base.type,
  date: base.date,
  room: base.room,
  topic: base.topic,
  attendees: base.attendees,
  plan: base.plan,
  planKind: base.planKind,
  taskTitle: base.taskTitle,
  note: base.note,
  academicYear: base.academicYear,
}).min(1);

exports.idSchema = Joi.object({ id: objectId.required() });
exports.residentIdSchema = Joi.object({ residentId: objectId.required() });

exports.listQuery = Joi.object({
  resident: optionalObjectId(objectId),
  type: optionalString(Joi.string().valid(...TYPES)),
  planKind: optionalString(Joi.string().valid(...PLAN_KINDS)),
  fromDate: optionalString(Joi.date()),
  toDate: optionalString(Joi.date()),
  page: optionalNumber(Joi.number().integer().min(1).default(1)),
  limit: optionalNumber(Joi.number().integer().min(1).max(100).default(10)),
});

exports.TYPES = TYPES;
exports.PLAN_KINDS = PLAN_KINDS;
