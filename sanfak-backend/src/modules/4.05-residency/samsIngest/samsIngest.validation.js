"use strict";

const Joi = require("joi");
const { ErrorHandler } = require("#shared/error");
const { PIN_RE } = require("#modules/4.05-residency/_services/residentAccount");
const {
  SAMS_SCHEMA_VERSION,
  MAX_PACKET_DAYS,
  DAY_RE,
  DBNAME_RE,
  isDayKey,
} = require("./samsContract");

const MAX_TENANTS = 2000;
const MAX_PEOPLE = 50_000;
const MAX_RECORDS = 1000;

const day = Joi.string()
  .pattern(DAY_RE)
  .custom((v, helpers) => (isDayKey(v) ? v : helpers.error("any.invalid")))
  .messages({ "any.invalid": "{{#label}} mavjud kalendar kuni emas" });
const nullableDay = day.allow(null).required();
const count = Joi.number().integer().min(0);
const pin = Joi.string().pattern(PIN_RE);
const dbname = Joi.string().pattern(DBNAME_RE);
const orgTitle = Joi.string().max(300).allow("").empty(null).default("");
const shortText = (max) => Joi.string().max(max).allow(null, "").default(null);
const deviceCode = Joi.number().integer().min(0).max(99).allow(null).default(null);

const recordSchema = Joi.object({
  attendId: Joi.string().min(1).max(64).required(),
  date: day.required(),
  accessTime: shortText(16),
  exitTime: shortText(16),
  deviceType: Joi.array()
    .items(Joi.object({ device: deviceCode, type: deviceCode }))
    .max(1000)
    .default([]),
  lated: Joi.number().allow(null).default(null),
  earlyLeft: Joi.number().allow(null).default(null),
});

const personSchema = Joi.object({
  jshshir: pin.required(),
  userId: Joi.string().min(1).max(64).required(),
  hasShift: Joi.boolean().required(),
  since: nullableDay,
  lastActive: shortText(32),
  active: Joi.boolean(),
  records: Joi.array().items(recordSchema).max(MAX_RECORDS).unique("attendId").required(),
});

const daySchema = Joi.object({
  day: day.required(),
  rosterScanCount: count.required(),
  expectedResidents: count.required(),
  scannedResidents: count.required(),
  deviceMix: Joi.object({
    hikvision: count.required(),
    mobile: count.required(),
    server: count.required(),
    in: count.required(),
    out: count.required(),
  }).required(),
});

const tenantSchema = Joi.object({
  orgId: Joi.string().max(64).allow("").required(),
  dbname: dbname.required(),
  orgTitle,
  horizon: nullableDay,
  days: Joi.array().items(daySchema).min(1).max(MAX_PACKET_DAYS).unique("day").required(),
  people: Joi.array().items(personSchema).max(MAX_PEOPLE).unique("jshshir").required(),
});

const orgRef = Joi.object({ dbname: dbname.required(), orgTitle });

const scanSchema = Joi.object({
  tenantsScanned: count.required(),
  tenantsWithResidents: count.required(),
  failedTenants: Joi.array().items(orgRef).max(MAX_TENANTS),
  tenantSetChanged: Joi.object({
    added: Joi.array().items(orgRef).max(MAX_TENANTS).required(),
    removed: Joi.array().items(dbname).max(MAX_TENANTS).required(),
  }).allow(null),
});

const packetSchema = Joi.object({
  schemaVersion: Joi.number().valid(SAMS_SCHEMA_VERSION).required(),
  packetId: Joi.string().max(64),
  trigger: Joi.string().valid("tick", "reconcile", "resend", "manual"),
  emittedAt: Joi.date().iso().required(),
  serverUtcOffsetMinutes: Joi.number().integer().min(-840).max(840),
  window: Joi.object({ from: day.required(), to: day.required() }).required(),
  scan: scanSchema.required(),
  tenants: Joi.array().items(tenantSchema).max(MAX_TENANTS).unique("dbname").required(),
  unresolved: Joi.array().items(pin).max(MAX_PEOPLE).unique().required(),
  unresolvedReasons: Joi.array()
    .items(
      Joi.object({
        jshshir: pin.required(),
        reason: Joi.string().max(64).required(),
        dbname: dbname.allow(null),
        orgTitle: Joi.string().max(300).allow("", null),
      }),
    )
    .max(MAX_PEOPLE * 2),
  ambiguous: Joi.array()
    .items(
      Joi.object({
        jshshir: pin.required(),
        dbnames: Joi.array().items(dbname).min(1).max(100).unique().required(),
        userCount: count,
      }),
    )
    .max(MAX_PEOPLE)
    .unique("jshshir")
    .required(),
});

const VALIDATE_OPTIONS = {
  abortEarly: true,
  convert: true,
  stripUnknown: { objects: true, arrays: false },
};

const describeError = (error) => {
  const first = error.details[0];
  return `${first.path.join(".")} (${first.type})`;
};

function parsePacket(body) {
  if (body?.schemaVersion !== SAMS_SCHEMA_VERSION) {
    throw new ErrorHandler(400, "SAMS paketi versiyasi qo'llab-quvvatlanmaydi", "", {
      reason: "unsupported_schema_version",
      supported: [SAMS_SCHEMA_VERSION],
    });
  }
  const { error, value } = packetSchema.validate(body, VALIDATE_OPTIONS);
  if (error) {
    throw new ErrorHandler(400, "SAMS paketi shartnomaga mos emas", describeError(error), {
      reason: "contract",
    });
  }
  return value;
}

module.exports = { parsePacket, packetSchema };
