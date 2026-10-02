"use strict";

const { ErrorHandler } = require("#shared/error");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const { daysInclusive } = require("#modules/4.05-residency/samsIngest/samsContract");
const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const Outage = require("./residencySamsOutage.model");
const { requestResolution } = require("./outageResolution");

const MAX_SPAN_DAYS = 366;
const NAME_SELECT = "firstName lastName middleName";
const POP = [
  { path: "createdBy", select: NAME_SELECT },
  { path: "cancelledBy", select: NAME_SELECT },
];
const FIELDS = [
  "_id", "from", "to", "dbname", "orgTitle", "reason", "createdBy",
  "createdAt", "cancelledAt", "cancelledBy", "cancelReason",
];

const toDTO = (doc) => Object.fromEntries(FIELDS.map((k) => [k, doc[k] ?? null]));

const rangeInvalid = (detail) =>
  new ErrorHandler(400, "Uzilish oynasi oralig'i noto'g'ri", detail, { reason: "outage_range_invalid" });

function assertRange({ from, to }, today) {
  if (from > to) throw rangeInvalid(`${from} > ${to}`);
  if (to > today) throw rangeInvalid(`${to} > ${today}`);
  if (daysInclusive(from, to) > MAX_SPAN_DAYS) throw rangeInvalid(`> ${MAX_SPAN_DAYS} kun`);
}

async function clinicTitle(dbname) {
  const row = await SamsOrgDay.findOne({ dbname }).sort({ day: -1 }).select("orgTitle").lean();
  if (!row) {
    throw new ErrorHandler(400, "Bunday klinika SAMS ma'lumotlarida yo'q", dbname, {
      reason: "unknown_clinic",
    });
  }
  return row.orgTitle || "";
}

async function findDTO(id) {
  const doc = await Outage.findById(id).populate(POP).lean();
  return toDTO(doc);
}

async function create(dto, user, now = new Date()) {
  assertRange(dto, uzDayKey(now));
  const orgTitle = dto.dbname ? await clinicTitle(dto.dbname) : null;
  const doc = await Outage.create({
    from: dto.from,
    to: dto.to,
    dbname: dto.dbname,
    orgTitle,
    reason: dto.reason,
    createdBy: user._id,
    resolutionPendingSince: now,
    resolutionAttempts: 1,
  });
  await requestResolution(doc, now);
  return findDTO(doc._id);
}

async function cancel(id, reason, user, now = new Date()) {
  const doc = await Outage.findOneAndUpdate(
    { _id: id, cancelledAt: null },
    {
      $set: {
        cancelledAt: now,
        cancelledBy: user._id,
        cancelReason: reason,
        resolutionPendingSince: now,
        resolutionAttempts: 1,
      },
    },
    { new: true },
  );
  if (!doc) {
    if (await Outage.exists({ _id: id })) {
      throw new ErrorHandler(409, "Uzilish oynasi allaqachon bekor qilingan", "", { reason: "already_cancelled" });
    }
    throw new ErrorHandler(404, "Uzilish oynasi topilmadi", "", { reason: "outage_not_found" });
  }
  await requestResolution(doc, now);
  return findDTO(id);
}

const STATUS_FILTERS = {
  active: { cancelledAt: null },
  cancelled: { cancelledAt: { $ne: null } },
  all: {},
};

function listFilter(query) {
  const filter = { ...STATUS_FILTERS[query.status || "active"] };
  if (query.to) filter.from = { $lte: query.to };
  if (query.from) filter.to = { $gte: query.from };
  return filter;
}

async function paginate(query) {
  const result = await Outage.paginate(listFilter(query), {
    page: Number(query.page),
    limit: Number(query.limit),
    sort: { from: -1, _id: -1 },
    populate: POP,
    lean: true,
  });
  return { ...result, docs: result.docs.map(toDTO) };
}

module.exports = { create, cancel, paginate, listFilter, assertRange, MAX_SPAN_DAYS };
