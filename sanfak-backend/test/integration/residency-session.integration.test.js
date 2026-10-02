"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
const Group = require("#references/group/group.model");
const Science = require("#references/science/science.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const S = require("#modules/4.05-residency/residencySession/residencySession.service");
const { fanOut } = require("#modules/4.05-residency/_services/sessionRoster");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");
const { todayUz, academicYearLastDay } = require("#modules/4.05-residency/_services/sessionDay");
const { GRANTS, NEW_ROLES } = require("../../seed/residency-roles.seed");

const app = express();
app.use(bodyParser.json());
app.use("/api/residency-sessions", require("#modules/4.05-residency/residencySession/residencySession.routes"));
app.use((err, req, res, next) => handleError(err, res));

const ROOT = "/api/residency-sessions";
const dayOffset = (n) => new Date(Date.parse(`${todayUz()}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
const SCOPE_OF = { ...Object.fromEntries(NEW_ROLES.map((r) => [r.title, r.scopeLevel])), kafedra_mudiri: "department", rektor: "global" };

async function roleOf(title) {
  const existing = await RoleModel.findOne({ title });
  if (existing) return existing;
  const permissions = Object.entries(GRANTS[title] || {}).map(([section, actionKeys]) => ({ section, actionKeys }));
  return RoleModel.create({ title, permissions, scopeLevel: SCOPE_OF[title] || "global", active: true });
}

async function actor(title, extra = {}) {
  const role = await roleOf(title);
  const doc = await UserModel.create({ firstName: "Test", lastName: title, middleName: "X", role: role._id, active: true, ...extra });
  const user = { ...doc.toObject(), role: role.toObject() };
  return { user, auth: `Bearer ${jwt.sign({ _id: String(doc._id) }, process.env.JWT_SECRET)}` };
}

let n = 0;
const resident = (group, extra = {}) =>
  Resident.create({
    program: "ordinatura", fullName: `Rezident ${(n += 1)}`, courseNumber: 1, group: group._id,
    groupTitle: group.title, status: "oquvda", active: true, ...extra,
  });

async function world() {
  const [group, other, science] = await Promise.all([
    Group.create({ title: "ORD-1" }), Group.create({ title: "ORD-2" }), Science.create({ title: "Terapiya" }),
  ]);
  const [teacher, teacher2, office] = [await actor("klinik_ustoz"), await actor("klinik_ustoz"), await actor("magistratura_bolim")];
  const sup = { supervisor: teacher.user._id };
  const r = {
    mine1: await resident(group, sup),
    mine2: await resident(group, sup),
    foreign: await resident(group, { supervisor: teacher2.user._id }),
    unsupervised: await resident(group),
    onLeave: await resident(group, { ...sup, status: "akademik_tatil" }),
    drafted: await resident(group, { ...sup, expulsionOrderCreated: true }),
    master: await resident(group, { ...sup, program: "magistratura" }),
    inactive: await resident(group, { ...sup, active: false }),
    deleted: await resident(group, sup),
    otherGroup: await resident(other, sup),
  };
  await Resident.updateOne({ _id: r.deleted._id }, { $set: { deletedAt: new Date() } });
  const body = (extra = {}) => ({ day: todayUz(), group: String(group._id), science: String(science._id), lessonType: "amaliy", hours: 2, ...extra });
  return { group, science, teacher, teacher2, office, r, body };
}

const post = (who, body) => request(app).post(ROOT).set("Authorization", who.auth).send(body);
const cancelReq = (who, id, reason = "Xato e'lon") =>
  request(app).put(`${ROOT}/${id}/cancel`).set("Authorization", who.auth).send({ reason });
const liveOf = (filter = {}) => Roster.find({ ...filter, cancelledAt: null }).lean();
const ids = (rows, key = "resident") => rows.map((x) => String(x[key])).sort();
const idsOf = (...docs) => docs.map((d) => String(d._id)).sort();
function gate() {
  let open;
  let reached;
  const opened = new Promise((res) => (open = res));
  const arrived = new Promise((res) => (reached = res));
  return { open, arrived, hooks: { beforeWrite: async () => { reached(); await opened; } } };
}

beforeAll(() => Promise.all([Session.init(), Roster.init()]));
afterEach(() => jest.restoreAllMocks());

describe("A/B — kim kutiladi (kesim)", () => {
  test("A: klinik ustoz — faqat O'Z mos rezidentlari", async () => {
    const w = await world();
    const res = await post(w.teacher, w.body({ teacher: String(w.teacher2.user._id) }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ message: "Mashg'ulot e'lon qilindi", framed: 2, conflicts: [] });
    expect(res.body.session).toMatchObject({
      day: todayUz(), groupTitle: "ORD-1", scienceTitle: "Terapiya", hours: 2, rosterScope: "supervised",
      status: "announced", framedCount: 2, canCancel: true, announcedBy: { _id: String(w.teacher.user._id), middleName: "X" },
    });
    expect(res.body.session.fannedOutAt).toBeTruthy();
    const frames = await liveOf();
    expect(ids(frames)).toEqual(idsOf(w.r.mine1, w.r.mine2));
    expect(frames[0]).toMatchObject({ outcome: "pending", outcomeReason: null, hours: 2, day: todayUz(), cancelledAt: null });
  });

  test("B: bo'lim — butun guruh (ustozsizlar ham), kesimdan tashqarilar yo'q", async () => {
    const w = await world();
    const res = await post(w.office, w.body());
    expect(res.status).toBe(201);
    expect(res.body.session.rosterScope).toBe("group");
    expect(ids(await liveOf())).toEqual(idsOf(w.r.mine1, w.r.mine2, w.r.foreign, w.r.unsupervised));
  });
});

describe("C/D — takroriy e'lon (I1)", () => {
  test("C: ikki parallel bir xil POST — [201, 409], bitta sessiya", async () => {
    const w = await world();
    const results = await Promise.all([post(w.teacher, w.body()), post(w.teacher, w.body())]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const dupe = results.find((r) => r.status === 409);
    expect(dupe.body.reason).toBe("session_already_announced");
    const sessions = await Session.find().lean();
    expect(sessions).toHaveLength(1);
    expect(dupe.body.session).toBe(String(sessions[0]._id));
    expect(await Roster.countDocuments({ cancelledAt: null })).toBe(2);
  });

  test("D: uzilgan fan-out — takroriy POST tiklaydi va 409 qaytaradi", async () => {
    const w = await world();
    const orphan = await Session.create({
      ...w.body(), group: w.group._id, science: w.science._id, announcedBy: w.teacher.user._id,
      rosterScope: "supervised", status: "announced",
    });
    expect(orphan.fannedOutAt).toBeNull();
    const res = await post(w.teacher, w.body());
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ reason: "session_already_announced", session: String(orphan._id) });
    expect(ids(await liveOf({ session: orphan._id }))).toEqual(idsOf(w.r.mine1, w.r.mine2));
    const healed = await Session.findById(orphan._id).lean();
    expect(healed.fannedOutAt).toBeTruthy();
    expect(healed.framedCount).toBe(2);
  });
});

describe("E — ikki sessiya bir darsga (I2, darvoza)", () => {
  test("pre-check'dan birga o'tgan fan-out'lar — har rezidentda bitta jonli freym", async () => {
    const w = await world();
    const [gA, gB] = [gate(), gate()];
    const input = w.body();
    const pA = S.announce(input, w.teacher.user, { hooks: gA.hooks });
    const pB = S.announce(input, w.office.user, { hooks: gB.hooks });
    await Promise.all([gA.arrived, gB.arrived]);
    expect(await Roster.countDocuments()).toBe(0);
    gA.open();
    gB.open();
    const [a, b] = await Promise.all([pA, pB]);
    const frames = await liveOf();
    expect(ids(frames)).toEqual(idsOf(w.r.mine1, w.r.mine2, w.r.foreign, w.r.unsupervised));
    for (const mine of [w.r.mine1, w.r.mine2]) {
      const winner = frames.find((f) => String(f.resident) === String(mine._id)).session;
      const loser = String(winner) === String(a.session._id) ? b : a;
      expect(loser.conflicts.map((c) => [String(c.resident), String(c.session)])).toContainEqual([String(mine._id), String(winner)]);
    }
    expect(a.framed + b.framed).toBe(4);
  });
});

describe("F — bekor qilish fan-out bilan poygada (I4, darvoza)", () => {
  test("fan-out ushlangan paytda bekor qilindi — jonli freym qolmaydi", async () => {
    const w = await world();
    const g = gate();
    const pending = S.announce(w.body(), w.teacher.user, { hooks: g.hooks });
    await g.arrived;
    const session = await Session.findOne({ announcedBy: w.teacher.user._id }).lean();
    const cancelled = await cancelReq(w.teacher, session._id);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ cancelledFrames: 0, session: { status: "cancelled", canCancel: false } });
    g.open();
    const result = await pending;
    expect(result.framed).toBe(0);
    expect(await Roster.countDocuments({ cancelledAt: null })).toBe(0);
    expect(await Roster.countDocuments({ session: session._id, cancelledAt: { $ne: null } })).toBe(2);
    expect((await Session.findById(session._id).lean()).status).toBe("cancelled");
  });
});

describe("N — qisman xato: bekor sessiyada jonli freym qolmaydi (I4, tiklash)", () => {
  const liveOn = (id) => Roster.countDocuments({ session: id, cancelledAt: null });

  test("N1: CAS'dan keyin freym qadami yiqildi — takroriy bekor qilish tiklaydi (409), qayta e'lon 201", async () => {
    const w = await world();
    const id = (await post(w.teacher, w.body())).body.session._id;
    jest.spyOn(Roster, "updateMany").mockImplementationOnce(() => Promise.reject(new Error("socket closed")));
    expect((await cancelReq(w.teacher, id)).status).toBe(500);
    expect((await Session.findById(id).lean()).status).toBe("cancelled");
    expect(await liveOn(id)).toBe(2);
    const retry = await cancelReq(w.teacher, id);
    expect(retry.status).toBe(409);
    expect(retry.body.reason).toBe("session_already_cancelled");
    expect(await liveOn(id)).toBe(0);
    const re = await post(w.teacher, w.body());
    expect(re.status).toBe(201);
    expect(re.body.framed).toBe(2);
  });

  test("N4: bekor qilish yiqildi — takroriy bekor qilishsiz qayta e'lon ham tiklaydi (201, all_residents_framed EMAS)", async () => {
    const w = await world();
    const id = (await post(w.teacher, w.body())).body.session._id;
    jest.spyOn(Roster, "updateMany").mockImplementationOnce(() => Promise.reject(new Error("socket closed")));
    expect((await cancelReq(w.teacher, id)).status).toBe(500);
    expect(await liveOn(id)).toBe(2);
    const re = await post(w.teacher, w.body());
    expect(re.status).toBe(201);
    expect(re.body).toMatchObject({ framed: 2, conflicts: [] });
    expect(await liveOn(id)).toBe(0);
  });

  test("N2: fan-out qisman yozib yiqildi, bekor qilish darvoza ichida — jonli freym qolmaydi", async () => {
    const w = await world();
    const g = gate();
    const insertMany = Roster.insertMany.bind(Roster);
    jest.spyOn(Roster, "insertMany").mockImplementationOnce(async (rows, opts) => {
      await insertMany(rows.slice(0, 1), opts);
      throw Object.assign(new Error("write concern timeout"), { writeErrors: [] });
    });
    const pending = S.announce(w.body(), w.teacher.user, { hooks: g.hooks }).then(() => null, (err) => err);
    await g.arrived;
    const session = await Session.findOne({ announcedBy: w.teacher.user._id }).lean();
    expect((await cancelReq(w.teacher, session._id)).body.cancelledFrames).toBe(0);
    g.open();
    expect((await pending)?.message).toBe("write concern timeout");
    expect(await Roster.countDocuments({ session: session._id })).toBe(1);
    expect(await liveOn(session._id)).toBe(0);
  });

  test("N3: ikkala tiklash qadami yiqilgan yetim freymlar — bekor sessiyaga fanOut supuradi", async () => {
    const w = await world();
    const id = (await post(w.teacher, w.body())).body.session._id;
    const cancelledAt = new Date();
    await Session.updateOne({ _id: id }, { $set: { status: "cancelled", cancelledAt } });
    expect(await liveOn(id)).toBe(2);
    await expect(fanOut(await Session.findById(id).lean())).resolves.toEqual({ framed: 0, conflicts: [] });
    expect(await liveOn(id)).toBe(0);
    const swept = await Roster.find({ session: id }).lean();
    expect(swept.map((f) => f.cancelledAt.getTime())).toEqual([cancelledAt.getTime(), cancelledAt.getTime()]);
  });
});

describe("G — bekor qilish", () => {
  test("freymlar bekor, xuddi shu kalit qayta e'lon qilinadi; ikkinchi bekor — 409", async () => {
    const w = await world();
    const first = await post(w.teacher, w.body());
    const id = first.body.session._id;
    expect((await cancelReq(w.teacher2, id)).status).toBe(404);
    const res = await cancelReq(w.teacher, id, "  Dars ko'chirildi  ");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cancelledFrames: 2, session: { status: "cancelled", cancelReason: "Dars ko'chirildi" } });
    expect(res.body.session.cancelledBy).toMatchObject({ _id: String(w.teacher.user._id), middleName: "X" });
    expect(await Roster.countDocuments({ session: id, cancelledAt: null })).toBe(0);
    const again = await cancelReq(w.teacher, id);
    expect(again.status).toBe(409);
    expect(again.body.reason).toBe("session_already_cancelled");
    const re = await post(w.teacher, w.body());
    expect(re.status).toBe(201);
    expect(re.body.framed).toBe(2);
  });

  test("kechagi sessiya — 409 session_day_closed; bo'lim begona sessiyani bekor qiladi", async () => {
    const w = await world();
    const old = await Session.create({
      ...w.body({ day: dayOffset(-1) }), group: w.group._id, science: w.science._id,
      announcedBy: w.teacher.user._id, rosterScope: "supervised", status: "announced",
    });
    const closed = await cancelReq(w.office, old._id);
    expect(closed.status).toBe(409);
    expect(closed.body.reason).toBe("session_day_closed");
    const fresh = await post(w.teacher, w.body());
    expect((await cancelReq(w.office, fresh.body.session._id)).status).toBe(200);
    expect((await cancelReq(w.office, "0".repeat(24))).status).toBe(404);
  });
});

describe("H/I — sana va ruxsat", () => {
  test("H: kecha va keyingi o'quv yili — 400 day_not_announceable", async () => {
    const w = await world();
    const nextYear = `${Number(academicYearLastDay(todayUz()).slice(0, 4))}-09-01`;
    for (const day of [dayOffset(-1), nextYear]) {
      const res = await post(w.office, w.body({ day }));
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ reason: "day_not_announceable", from: todayUz() });
    }
    expect(await Session.countDocuments()).toBe(0);
  });

  test("I: kafedra/rezident — missing_permission; super_admin — not_session_announcer", async () => {
    const w = await world();
    for (const title of ["kafedra_mudiri", "rezident"]) {
      const res = await post(await actor(title), w.body());
      expect(res.status).toBe(403);
      expect(res.body.reason).toBe("missing_permission");
    }
    const admin = await post(await actor("super_admin"), w.body());
    expect(admin.status).toBe(403);
    expect(admin.body.reason).toBe("not_session_announcer");
    expect(await Session.countDocuments()).toBe(0);
  });
});

describe("J — ko'rish doirasi", () => {
  test("rezident — faqat o'zi freymlangan sessiyalar va o'z qatori", async () => {
    const w = await world();
    const pupil = await actor("rezident");
    await Resident.updateOne({ _id: w.r.foreign._id }, { $set: { user: pupil.user._id } });
    const officeSession = (await post(w.office, w.body())).body.session._id;
    const teacherSession = (await post(w.teacher, w.body({ lessonType: "maruza" }))).body.session._id;
    const list = await request(app).get(`${ROOT}/paginate?page=1&limit=10`).set("Authorization", pupil.auth);
    expect(list.status).toBe(200);
    expect(list.body.docs.map((d) => d._id)).toEqual([officeSession]);
    const detail = await request(app).get(`${ROOT}/${officeSession}`).set("Authorization", pupil.auth);
    expect(detail.body.roster.map((x) => x.resident._id)).toEqual([String(w.r.foreign._id)]);
    expect(detail.body.roster[0]).toMatchObject({ state: "pending", resident: { fullName: w.r.foreign.fullName } });
    expect((await request(app).get(`${ROOT}/${teacherSession}`).set("Authorization", pupil.auth)).status).toBe(404);
  });

  test("ustoz — o'zinikini va o'z rezidenti freymlangan bo'lim sessiyasini; roster faqat o'z rezidentlari", async () => {
    const w = await world();
    const officeSession = (await post(w.office, w.body())).body.session._id;
    const own = (await post(w.teacher, w.body({ lessonType: "maruza" }))).body.session._id;
    const foreignOnly = (await post(w.teacher2, w.body({ lessonType: "test" }))).body.session._id;
    const list = await request(app).get(`${ROOT}/paginate?page=1&limit=10`).set("Authorization", w.teacher.auth);
    expect(list.body.docs.map((d) => d._id).sort()).toEqual([officeSession, own].sort());
    expect(list.body.docs[0]).toMatchObject({ group: { title: "ORD-1" }, science: { title: "Terapiya" }, announcedBy: { middleName: "X" } });
    expect(list.body.docs[0]).not.toHaveProperty("id");
    const detail = await request(app).get(`${ROOT}/${officeSession}`).set("Authorization", w.teacher.auth);
    expect(detail.body.roster.map((x) => x.resident._id).sort()).toEqual(idsOf(w.r.mine1, w.r.mine2));
    expect(detail.body.session.canCancel).toBe(false);
    expect((await request(app).get(`${ROOT}/${foreignOnly}`).set("Authorization", w.teacher.auth)).status).toBe(404);
    const office = await request(app).get(`${ROOT}/${officeSession}`).set("Authorization", w.office.auth);
    expect(office.body.roster).toHaveLength(4);
  });
});

describe("K — ustozsiz rezidentlar (Q5=B)", () => {
  test("bo'lim — faqat supervisor:null va mos; ustoz — bo'sh", async () => {
    const w = await world();
    await resident(w.group, { status: "akademik_tatil" });
    const office = await request(app).get(`${ROOT}/unsupervised-residents`).set("Authorization", w.office.auth);
    expect(office.status).toBe(200);
    expect(office.body.docs.map((d) => d._id)).toEqual([String(w.r.unsupervised._id)]);
    expect(Object.keys(office.body.docs[0]).sort()).toEqual([
      "_id", "courseNumber", "departmentTitle", "fullName", "group", "groupTitle", "specialtyTitle",
    ]);
    const teacher = await request(app).get(`${ROOT}/unsupervised-residents?group=${w.group._id}`).set("Authorization", w.teacher.auth);
    expect(teacher.body.docs).toEqual([]);
  });
});

describe("L/M — indekslar va D-MODE inert", () => {
  test("L: getIndexes — nomlar, unique, partial; ikkinchi jonli freym — E11000", async () => {
    const byName = async (Model) => Object.fromEntries((await Model.collection.indexes()).map((i) => [i.name, i]));
    const s = await byName(Session);
    const f = await byName(Roster);
    expect(Object.keys(s).sort()).toEqual(["_id_", "announcedBy_day", "day_desc", "group_day", "session_announced_unique"]);
    expect(s.session_announced_unique).toMatchObject({ unique: true, partialFilterExpression: { status: "announced" } });
    expect(Object.keys(f).sort()).toEqual(["_id_", "resident_day", "resident_lesson_live_unique", "session_resident_unique"]);
    for (const name of ["resident_lesson_live_unique", "session_resident_unique"]) {
      expect(f[name]).toMatchObject({ unique: true, partialFilterExpression: { cancelledAt: null } });
    }
    const w = await world();
    await post(w.teacher, w.body());
    const [frame] = await liveOf();
    const { _id, ...copy } = frame;
    expect(_id).toBeTruthy();
    await expect(Roster.collection.insertOne({ ...copy, session: _id })).rejects.toMatchObject({ code: 11000 });
    await expect(Roster.collection.insertOne({ ...copy, session: _id, cancelledAt: new Date() })).resolves.toBeTruthy();
  });

  test("M: e'lon attendance'ga yozmaydi — soat hisobi o'zgarmaydi", async () => {
    const w = await world();
    const before = await countUnexcusedHours(w.r.mine1._id);
    expect((await post(w.teacher, w.body())).status).toBe(201);
    expect(await Attendance.countDocuments()).toBe(0);
    expect(await countUnexcusedHours(w.r.mine1._id)).toBe(before);
  });
});
