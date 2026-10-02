"use strict";

const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const Session = require("./residencySession.model");
const Roster = require("./residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Group = require("#references/group/group.model");
const Science = require("#references/science/science.model");
const { residentIdsFor } = require("#modules/4.05-residency/_services/residentScope");
const { announceableRange, isDayOpen } = require("#modules/4.05-residency/_services/sessionDay");
const {
  previewRoster,
  fanOut,
  cancelFrames,
  studyCutFilter,
} = require("#modules/4.05-residency/_services/sessionRoster");
const winston = require("#shared/winston.logger");
const { resolveSession } = require("#modules/4.05-residency/_services/sessionResolution");
const { rowStatuses, rosterEvidence } = require("./residencySessionRosterView");

const { SESSION_ANNOUNCED, SESSION_CANCELLED, ANNOUNCED_INDEX_NAME } = Session;
const { FRAME_VOID, LIVE_FRAME } = Roster;

const fail = (status, message, reason, extra = {}) =>
  new ErrorHandler(status, message, reason, { reason, ...extra });
const notFound = () => fail(404, "Mashg'ulot topilmadi", "session_not_found");
const sameId = (a, b) => a != null && b != null && String(a?._id ?? a) === String(b?._id ?? b);

function announcerKind(user) {
  const title = user?.role?.title;
  if (title === ROLES.MAGISTRATURA_BOLIM) return "office";
  if (title === ROLES.KLINIK_USTOZ) return "teacher";
  return null;
}
const ROSTER_SCOPE_OF = { office: "group", teacher: "supervised" };

function assertAnnouncer(user) {
  const kind = announcerKind(user);
  if (!kind) {
    throw fail(403, "Mashg'ulotni faqat klinik ustoz yoki bo'lim xodimi e'lon qiladi", "not_session_announcer");
  }
  return kind;
}

function assertAnnounceable(day, now) {
  const { from, to } = announceableRange(now);
  if (day < from || day > to) {
    throw fail(400, `Mashg'ulot sanasi ${from} — ${to} oralig'ida bo'lishi kerak`, "day_not_announceable", {
      from,
      to,
    });
  }
}

async function loadRefs({ group, science }) {
  const [g, s] = await Promise.all([
    Group.findById(group).select("title active").lean(),
    Science.findById(science).select("title active").lean(),
  ]);
  if (!g || g.active === false) throw fail(400, "Guruh topilmadi yoki faol emas", "group_not_found");
  if (!s || s.active === false) throw fail(400, "Fan topilmadi yoki faol emas", "science_not_found");
  return { group: g, science: s };
}

function buildDraft(input, user, kind, refs) {
  return {
    day: input.day,
    group: refs.group._id,
    groupTitle: refs.group.title ?? null,
    science: refs.science._id,
    scienceTitle: refs.science.title ?? null,
    lessonType: input.lessonType,
    hours: input.hours,
    announcedBy: user._id,
    rosterScope: ROSTER_SCOPE_OF[kind],
    status: SESSION_ANNOUNCED,
  };
}

const findAnnounced = (draft) =>
  Session.findOne({
    announcedBy: draft.announcedBy,
    group: draft.group,
    day: draft.day,
    science: draft.science,
    lessonType: draft.lessonType,
    status: SESSION_ANNOUNCED,
  }).lean();

async function rejectDuplicate(existing, hooks) {
  if (existing) await fanOut(existing, hooks);
  throw fail(409, "Bu mashg'ulot allaqachon e'lon qilingan", "session_already_announced", {
    session: existing?._id ?? null,
  });
}

async function assertRosterAvailable(draft) {
  const { eligible, taken } = await previewRoster(draft);
  if (!eligible.length) {
    throw fail(400, "Guruhda bu mashg'ulotga mos rezident yo'q", "no_eligible_residents");
  }
  if (taken.length >= eligible.length) {
    throw fail(409, "Barcha rezidentlar shu darsga boshqa mashg'ulotda biriktirilgan", "all_residents_framed", {
      conflicts: taken.map((f) => ({ resident: f.resident, session: f.session })),
    });
  }
}

const isAnnouncedDuplicate = (err) =>
  err?.code === 11000 && String(err.message ?? "").includes(ANNOUNCED_INDEX_NAME);

async function createSession(draft, hooks) {
  try {
    return (await Session.create(draft)).toObject();
  } catch (err) {
    if (!isAnnouncedDuplicate(err)) throw err;
    return rejectDuplicate(await findAnnounced(draft), hooks);
  }
}

const POP = [
  { path: "group", select: "title" },
  { path: "science", select: "title" },
  { path: "announcedBy", select: "firstName lastName middleName" },
  { path: "cancelledBy", select: "firstName lastName middleName" },
];

const SESSION_FIELDS = [
  "_id", "day", "group", "groupTitle", "science", "scienceTitle", "lessonType", "hours",
  "announcedBy", "rosterScope", "status", "fannedOutAt", "framedCount", "cancelledAt",
  "cancelledBy", "cancelReason", "createdAt", "updatedAt",
];
const ROSTER_FIELDS = ["_id", "outcomeReason", "attendance", "resolvedAt"];
const ROSTER_RESIDENT_FIELDS = ["_id", "fullName", "groupTitle", "courseNumber", "specialtyTitle"];
const ROSTER_RESIDENT_SELECT = ROSTER_RESIDENT_FIELDS.filter((f) => f !== "_id").join(" ");

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

function canCancelSession(doc, user, now) {
  if (doc.status !== SESSION_ANNOUNCED || !isDayOpen(doc.day, now)) return false;
  const kind = announcerKind(user);
  return kind === "office" || (kind === "teacher" && sameId(doc.announcedBy, user._id));
}

function toDTO(doc, user, now) {
  return { ...pick(doc, SESSION_FIELDS), canCancel: canCancelSession(doc, user, now) };
}

function toRosterDTO(frame, rowStatus, lessonType) {
  const resident = frame.resident && typeof frame.resident === "object" ? pick(frame.resident, ROSTER_RESIDENT_FIELDS) : null;
  return { ...pick(frame, ROSTER_FIELDS), resident, ...rosterEvidence(frame, rowStatus, lessonType) };
}

async function dtoById(id, user, now) {
  return toDTO(await Session.findById(id).populate(POP).lean(), user, now);
}

async function announce(input, user, { now = new Date(), hooks } = {}) {
  const kind = assertAnnouncer(user);
  assertAnnounceable(input.day, now);
  const draft = buildDraft(input, user, kind, await loadRefs(input));
  const existing = await findAnnounced(draft);
  if (existing) await rejectDuplicate(existing, hooks);
  await assertRosterAvailable(draft);
  const session = await createSession(draft, hooks);
  const { framed, conflicts } = await fanOut(session, hooks);
  return { session: await dtoById(session._id, user, now), framed, conflicts };
}

async function voidOutcomes(id, now) {
  try {
    await resolveSession(id, { now, force: true });
  } catch (err) {
    winston.error(`[4.5 session] bekor qilingan sessiya yechilmadi session=${id}: ${err.message}`);
  }
}

async function rejectCancelled(id, cancelledAt) {
  await cancelFrames(id, cancelledAt);
  await voidOutcomes(id, new Date());
  throw fail(409, "Mashg'ulot allaqachon bekor qilingan", "session_already_cancelled");
}

async function rejectLostCas(id, now) {
  const current = await Session.findById(id).select("cancelledAt").lean();
  return rejectCancelled(id, current?.cancelledAt ?? now);
}

async function cancel(id, reason, user, { now = new Date() } = {}) {
  const kind = assertAnnouncer(user);
  const s = await Session.findById(id).lean();
  if (!s || (kind === "teacher" && !sameId(s.announcedBy, user._id))) throw notFound();
  if (s.status !== SESSION_ANNOUNCED) return rejectCancelled(id, s.cancelledAt ?? now);
  if (!isDayOpen(s.day, now)) throw fail(409, "Mashg'ulot kuni yopilgan — bekor qilib bo'lmaydi", "session_day_closed");
  const updated = await Session.findOneAndUpdate(
    { _id: id, status: SESSION_ANNOUNCED },
    { $set: { status: SESSION_CANCELLED, cancelledAt: now, cancelledBy: user._id, cancelReason: reason } },
    { new: true },
  ).lean();
  if (!updated) return rejectLostCas(id, now);
  const cancelledFrames = await cancelFrames(id, now);
  await voidOutcomes(id, new Date());
  return { session: await dtoById(id, user, now), cancelledFrames };
}

async function sessionScope(user) {
  const residentIds = await residentIdsFor(user);
  if (residentIds === null) return { filter: {}, residentIds };
  const sessionIds = await Roster.distinct("session", { resident: { $in: residentIds } });
  return { filter: { $or: [{ announcedBy: user._id }, { _id: { $in: sessionIds } }] }, residentIds };
}

function buildListFilter(q) {
  const f = {};
  if (q.from || q.to) f.day = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  for (const key of ["group", "science", "lessonType", "status", "announcedBy"]) {
    if (q[key]) f[key] = q[key];
  }
  return f;
}

async function paginate(q, user, { now = new Date() } = {}) {
  const scope = await sessionScope(user);
  const page = await Session.paginate(
    { ...scope.filter, ...buildListFilter(q) },
    { page: q.page, limit: q.limit, sort: { day: -1, createdAt: -1, _id: -1 }, populate: POP, lean: true },
  );
  return { ...page, docs: page.docs.map((d) => toDTO(d, user, now)) };
}

async function findOne(id, user, { now = new Date() } = {}) {
  const s = await Session.findById(id).populate(POP).lean();
  if (!s) throw notFound();
  const residentIds = await residentIdsFor(user);
  const scoped = residentIds === null ? {} : { resident: { $in: residentIds } };
  const visible =
    residentIds === null ||
    sameId(s.announcedBy, user._id) ||
    Boolean(await Roster.exists({ session: s._id, ...scoped }));
  if (!visible) throw notFound();
  const frames = await Roster.find({ session: s._id, ...LIVE_FRAME, outcome: { $ne: FRAME_VOID }, ...scoped })
    .populate({ path: "resident", select: ROSTER_RESIDENT_SELECT })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const statuses = await rowStatuses(frames);
  const roster = frames.map((f) => toRosterDTO(f, statuses.get(String(f.attendance)), s.lessonType));
  return { session: toDTO(s, user, now), roster };
}

async function unsupervisedResidents(q, user) {
  const residentIds = await residentIdsFor(user);
  const filter = { ...studyCutFilter(), supervisor: null };
  if (q.group) filter.group = q.group;
  if (residentIds !== null) filter._id = { $in: residentIds };
  return Resident.paginate(filter, {
    page: q.page,
    limit: q.limit,
    select: "fullName group groupTitle courseNumber specialtyTitle departmentTitle",
    sort: { groupTitle: 1, fullName: 1, _id: 1 },
    lean: true,
    leanWithId: false,
  });
}

module.exports = {
  announcerKind,
  announce,
  cancel,
  paginate,
  findOne,
  unsupervisedResidents,
  sessionScope,
  buildListFilter,
  toDTO,
  toRosterDTO,
  SESSION_FIELDS,
  ROSTER_FIELDS,
};
