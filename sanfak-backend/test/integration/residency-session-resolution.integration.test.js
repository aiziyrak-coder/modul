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
const Application = require("#modules/4.05-residency/residentApplication/residentApplication.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const samsFactsPort = require("#modules/4.05-residency/_services/samsFactsPort");
const { fanOut } = require("#modules/4.05-residency/_services/sessionRoster");
const { resolveSession, resolveSessionDays } = require("#modules/4.05-residency/_services/sessionResolution");
const SessionService = require("#modules/4.05-residency/residencySession/residencySession.service");
const GradeService = require("#modules/4.05-residency/residencySession/residencySessionGrade.service");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");
const { currentAcademicYearWindow } = require("#modules/4.05-residency/_services/unexcusedWindow");
const { todayUz } = require("#modules/4.05-residency/_services/sessionDay");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");
const { GRANTS } = require("../../seed/residency-roles.seed");

const app = express();
app.use(bodyParser.json());
app.use("/api/residency-sessions", require("#modules/4.05-residency/residencySession/residencySession.routes"));
app.use("/api/attendance", require("#modules/4.05-residency/attendance/attendance.routes"));
app.use("/api/applications", require("#modules/4.05-residency/residentApplication/residentApplication.routes"));
app.use((err, req, res, next) => handleError(err, res));

const YM = (() => {
  const d = new Date(currentAcademicYearWindow().from);
  d.setUTCMonth(d.getUTCMonth() + 2);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
})();
const D = (n) => `${YM}-${String(n).padStart(2, "0")}`;
const uzAt = (day, hhmm) => new Date(`${day}T${hhmm}:00.000+05:00`);
const dayEnd = (day) => uzAt(addDays(day, 1), "00:00");
const T = (h) => uzAt(D(20), "08:00").getTime() + h * 3600e3;
const NOW = new Date(T(0));

const NONE = () => null;
const CLOSED = (_id, day) => ({ measured: true, reason: null, dbname: "clinicA", packetAt: dayEnd(day), records: [] });
const SCANNED = (id, day) => ({ ...CLOSED(id, day), records: [{ accessTime: "09:05", exitTime: "13:00", inDevice: 1, outDevice: 1 }] });
function storePort(facts = CLOSED) {
  const port = { facts, outages: [] };
  port.loadSessionFacts = async ({ day, residentIds }) => ({
    presence: new Map(residentIds.map((id) => [String(id), port.facts(String(id), day)]).filter(([, f]) => f)),
    outages: port.outages.filter((o) => o.fromDay <= day && day <= o.toDay),
  });
  return port;
}

async function roleOf(title) {
  const permissions = Object.entries(GRANTS[title]).map(([section, actionKeys]) => ({ section, actionKeys }));
  const scopeLevel = title === "magistratura_bolim" ? "global" : "self";
  return (await RoleModel.findOne({ title })) ?? RoleModel.create({ title, permissions, scopeLevel, active: true });
}
async function actor(title) {
  const role = await roleOf(title);
  const doc = await UserModel.create({ firstName: "Test", lastName: title, middleName: "X", role: role._id, active: true });
  return { user: { ...doc.toObject(), role: role.toObject() }, auth: `Bearer ${jwt.sign({ _id: String(doc._id) }, process.env.JWT_SECRET)}` };
}
async function world() {
  const [group, science] = [await Group.create({ title: "ORD-1" }), await Science.create({ title: "Terapiya" })];
  const [teacher, other, office] = [await actor("klinik_ustoz"), await actor("klinik_ustoz"), await actor("magistratura_bolim")];
  const mk = (fullName) => Resident.create({
    program: "ordinatura", fullName, courseNumber: 1, group: group._id, groupTitle: "ORD-1",
    status: "oquvda", active: true, supervisor: teacher.user._id,
  });
  return { group, science, teacher, other, office, resident: await mk("Rezident Bir"), mk };
}
async function announce(w, day, extra = {}) {
  const s = await Session.create({
    day, group: w.group._id, groupTitle: "ORD-1", science: w.science._id, scienceTitle: "Terapiya", lessonType: "amaliy",
    hours: 8, announcedBy: w.teacher.user._id, rosterScope: "supervised", status: "announced", ...extra,
  });
  await fanOut(s._id);
  return s;
}
const rowsOf = (w, extra = {}) => Attendance.find({ resident: w.resident._id, ...extra }, null, { includeDeleted: true }).lean();
const frameOf = (s, w) => Roster.findOne({ session: s._id, resident: w.resident._id, cancelledAt: null }).lean();
const tick = () => new Promise((r) => setTimeout(r, 50));

function hold(model, method, match, { chain = false } = {}) {
  const original = model[method].bind(model);
  const gate = {};
  const released = new Promise((r) => (gate.release = r));
  gate.arrived = new Promise((r) => (gate.reached = r));
  let used = false;
  jest.spyOn(model, method).mockImplementation((...args) => {
    if (used || !match(...args)) return original(...args);
    used = true;
    gate.reached();
    if (chain) return { lean: () => released.then(() => original(...args).lean()) };
    return released.then(() => original(...args));
  });
  return gate;
}
const holdAttendanceUpdate = (match) => hold(Attendance, "updateOne", match);

function holdSeq(model, method, match, count) {
  const original = model[method].bind(model);
  const gates = Array.from({ length: count }, () => {
    const g = {};
    g.released = new Promise((r) => (g.release = r));
    g.arrived = new Promise((r) => (g.reached = r));
    return g;
  });
  let i = 0;
  jest.spyOn(model, method).mockImplementation((...args) => {
    if (i >= gates.length || !match(...args)) return original(...args);
    const g = gates[i++];
    g.reached();
    return g.released.then(() => original(...args));
  });
  return gates;
}

beforeAll(() => Promise.all([Attendance.init(), Session.init(), Roster.init(), Order.init()]));
afterEach(async () => {
  jest.restoreAllMocks();
  await tick();
});

describe("a — 72 soat sessiyalardan: loyiha ochiladi, uzilish oynasi qaytaradi (P3/P6a)", () => {
  test("9 × 8 soat absent → loyiha; uzilish → qatorlar yashirinadi, loyiha bekor", async () => {
    const w = await world();
    const days = Array.from({ length: 9 }, (_, i) => D(i + 1));
    for (const day of days) await announce(w, day);
    const port = storePort(CLOSED);

    await resolveSessionDays(days, { now: NOW, force: true, factsPort: port });
    const live = await rowsOf(w, { deletedAt: null });
    expect(live).toHaveLength(9);
    expect(live.every((r) => r.status === "absent" && r.hours === 8 && r.session && r.samsVerified === false)).toBe(true);
    expect(await countUnexcusedHours(w.resident._id)).toBe(72);
    expect(await Order.countDocuments({ resident: w.resident._id, status: "loyiha" })).toBe(1);
    expect((await Resident.collection.findOne({ _id: w.resident._id })).expulsionOrderCreated).toBe(true);

    port.outages = [{ fromDay: D(1), toDay: D(9), dbname: null }];
    const out = await resolveSessionDays(days, { now: new Date(T(1)), force: true, factsPort: port });
    expect(out).toMatchObject({ sessions: 9, changed: 9, recounted: 1 });
    const after = await rowsOf(w);
    expect(after).toHaveLength(9);
    expect(after.every((r) => r.deletedAt && r.deletionReason === "session:unmeasured:outage_window")).toBe(true);
    expect(await countUnexcusedHours(w.resident._id)).toBe(0);
    const [order] = await Order.find({ resident: w.resident._id }).lean();
    expect(order.status).toBe("bekor_qilingan");
    expect((await Resident.collection.findOne({ _id: w.resident._id })).expulsionOrderCreated).toBe(false);
  });
});

const app1 = (w, status = "tasdiqlangan", day = D(1)) =>
  Application.create({
    resident: w.resident._id, type: "other", reason: "Kasal", status, reviewedBy: w.office.user._id,
    fromDate: new Date(`${day}T00:00:00.000Z`), toDate: new Date(`${day}T00:00:00.000Z`),
  });
const review = (w, id, body) => request(app).put(`/api/applications/${id}/review`).set("Authorization", w.office.auth).send(body);
const storedHours = async (id) => (await Resident.collection.findOne({ _id: id })).totalUnexcusedHours ?? 0;

describe("b/c — ariza tartibidan qat'i nazar (bitta qoida)", () => {
  test("b: ariza OLDIN tasdiqlangan — qator darhol excused va arizaga bog'langan", async () => {
    const w = await world();
    const s = await announce(w, D(1));
    const a = await app1(w);
    await resolveSession(s._id, { now: NOW, force: true, factsPort: storePort(CLOSED) });
    const [row] = await rowsOf(w);
    expect(row).toMatchObject({ status: "excused", excuseReason: "Kasal", hours: 8 });
    expect(String(row.application)).toBe(String(a._id));
    expect(String((await frameOf(s, w)).excuseApplication)).toBe(String(a._id));
    expect(await countUnexcusedHours(w.resident._id)).toBe(0);
  });

  test("c: sessiya OLDIN — HTTP tasdiq → excused; qayta yechim pasaytirmaydi; bekor → absent, qayta yechim ham absent", async () => {
    const w = await world();
    const s = await announce(w, D(1));
    const port = storePort(CLOSED);
    await resolveSession(s._id, { now: NOW, force: true, factsPort: port });
    const a = await app1(w, "yangi");
    expect((await review(w, a._id, { status: "tasdiqlangan", fromDate: D(1), toDate: D(1) })).status).toBe(200);
    expect((await rowsOf(w))[0].status).toBe("excused");

    await resolveSession(s._id, { now: new Date(T(1)), force: true, factsPort: port });
    expect((await rowsOf(w))[0].status).toBe("excused");

    expect((await review(w, a._id, { status: "rad_etilgan" })).status).toBe(200);
    await resolveSession(s._id, { now: new Date(T(2)), force: true, factsPort: port });
    const [row] = await rowsOf(w);
    expect(row).toMatchObject({ status: "absent", application: null });
    expect(await countUnexcusedHours(w.resident._id)).toBe(8);
  });

  test("c: bo'limning qator darajasidagi sababli tasdig'i qayta yechimdan keyin ham qoladi", async () => {
    const w = await world();
    const s = await announce(w, D(1));
    const port = storePort(CLOSED);
    await resolveSession(s._id, { now: NOW, force: true, factsPort: port });
    const [row] = await rowsOf(w);
    const res = await request(app).put(`/api/attendance/${row._id}/approve-excuse`).set("Authorization", w.office.auth).send({ reason: "Tasdiqlandi" });
    expect(res.status).toBe(200);
    await resolveSession(s._id, { now: new Date(T(1)), force: true, factsPort: port });
    expect((await rowsOf(w))[0]).toMatchObject({ status: "excused", excuseReason: "Tasdiqlandi" });
  });

  test("c: klinik ustoz (GRANTS, o'z rezidenti) sababli qila olmaydi — 403, qator absent (D-18, EXC-Q1)", async () => {
    const w = await world();
    const s = await announce(w, D(1));
    await resolveSession(s._id, { now: NOW, force: true, factsPort: storePort(CLOSED) });
    const [row] = await rowsOf(w);
    const res = await request(app).put(`/api/attendance/${row._id}/approve-excuse`).set("Authorization", w.teacher.auth).send({ reason: "Tasdiqlandi" });
    expect(res.status).toBe(403);
    expect((await Attendance.findById(row._id).lean())).toMatchObject({ status: "absent", excuseApprovedBy: null });
    expect(await countUnexcusedHours(w.resident._id)).toBe(8);
  });
});

describe("d — tiklash, qayta qo'shish emas", () => {
  test("absent → unmeasured → absent: o'sha _id, E11000 yo'q; indeks mavjud", async () => {
    const w = await world();
    const s = await announce(w, D(2));
    const port = storePort(CLOSED);
    await resolveSession(s._id, { now: NOW, force: true, factsPort: port });
    const [first] = await rowsOf(w);

    port.facts = NONE;
    await resolveSession(s._id, { now: new Date(T(1)), force: true, factsPort: port });
    expect((await rowsOf(w))[0]).toMatchObject({ _id: first._id, deletionReason: "session:unmeasured:no_facts" });
    expect((await frameOf(s, w)).attendance).toBeNull();

    port.facts = CLOSED;
    const out = await resolveSession(s._id, { now: new Date(T(2)), force: true, factsPort: port });
    const rows = await rowsOf(w);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ _id: first._id, status: "absent", deletedAt: null });
    expect(String((await frameOf(s, w)).attendance)).toBe(String(first._id));
    expect(out.conflicts).toBe(0);

    const idx = (await Attendance.collection.indexes()).find((i) => i.name === "attendance_session_resident_unique");
    expect(idx).toMatchObject({ key: { session: 1, resident: 1 }, unique: true, partialFilterExpression: { session: { $type: "objectId" } } });
  });
});

describe("e — darvoza bilan ushlangan yechim poygalari", () => {
  test("eski o'tish (absent) qator yozuvida ushlangan, yangisi (present) yozdi — eski stale", async () => {
    const w = await world();
    const s = await announce(w, D(3));
    const gate = holdAttendanceUpdate((filter) => Boolean(filter.$or));
    const a = resolveSession(s._id, { now: new Date(T(1)), force: true, factsPort: storePort(CLOSED) });
    await gate.arrived;
    await resolveSession(s._id, { now: new Date(T(2)), force: true, factsPort: storePort(SCANNED) });
    gate.release();
    expect(await a).toMatchObject({ stale: 1, changed: 0 });
    const [row] = await rowsOf(w);
    expect(row).toMatchObject({ status: "present", samsVerified: true, sessionRev: T(2) });
    expect(await frameOf(s, w)).toMatchObject({ outcome: "present", resolvedRev: T(2) });
  });

  test("yangi o'tish «qator kerak emas» dedi, eski absent keyin tushdi — tuzatish o'tishi yashiradi, soat 0", async () => {
    const w = await world();
    const s = await announce(w, D(4));
    const port = storePort(CLOSED);
    const gate = holdAttendanceUpdate((filter) => Boolean(filter.$or));
    const a = resolveSession(s._id, { now: new Date(T(1)), force: true, factsPort: port });
    await gate.arrived;
    port.facts = NONE;
    expect(await resolveSession(s._id, { now: new Date(T(2)), force: true, factsPort: port })).toMatchObject({ changed: 0 });
    gate.release();
    expect(await a).toMatchObject({ repaired: 1 });
    const [row] = await rowsOf(w);
    expect(row.deletedAt).toBeTruthy();
    expect(await frameOf(s, w)).toMatchObject({ outcome: "unmeasured", resolvedRev: T(2) + 1 });
    expect(await countUnexcusedHours(w.resident._id)).toBe(0);
    expect(await storedHours(w.resident._id)).toBe(0);
  });
});

describe("e2 — o'qilgan holat CAS'i stale, freym hali shu o'tishniki (ko'rik R2)", () => {
  test("hide yozuvi ushlangan paytda ariza rad etildi — tuzatish o'tishi qatorni yashiradi, soat 0", async () => {
    const w = await world();
    const s = await announce(w, D(11));
    const a = await app1(w, "tasdiqlangan", D(11));
    const port = storePort(CLOSED);
    await resolveSession(s._id, { now: NOW, force: true, factsPort: port });
    expect((await rowsOf(w))[0].status).toBe("excused");

    port.facts = NONE;
    const gate = holdAttendanceUpdate((filter) => Boolean(filter.$or));
    const pass = resolveSession(s._id, { now: new Date(T(1)), force: true, factsPort: port });
    await gate.arrived;
    expect((await review(w, a._id, { status: "rad_etilgan" })).status).toBe(200);
    gate.release();
    expect(await pass).toMatchObject({ stale: 1, repaired: 1 });
    expect((await rowsOf(w))[0].deletedAt).toBeTruthy();
    expect(await frameOf(s, w)).toMatchObject({ outcome: "unmeasured", resolvedRev: T(1) + 1, attendance: null });
    expect(await countUnexcusedHours(w.resident._id)).toBe(0);
    expect(await storedHours(w.resident._id)).toBe(0);
  });
});

describe("e3 — bekor qilish: natijalar void, qator yashiriladi (ko'rik R1)", () => {
  const frameAny = (s) => Roster.findOne({ session: s._id }).lean();

  test("HTTP bekor qilish — present sessiya qatori yashiriladi, freym void", async () => {
    const w = await world();
    const s = await announce(w, addDays(todayUz(), 1));
    await resolveSession(s._id, { force: true, factsPort: storePort(SCANNED) });
    expect((await rowsOf(w))[0]).toMatchObject({ status: "present", deletedAt: null });
    const res = await request(app).put(`/api/residency-sessions/${s._id}/cancel`).set("Authorization", w.teacher.auth).send({ reason: "Kasallik" });
    expect(res.status).toBe(200);
    expect((await rowsOf(w))[0]).toMatchObject({ deletionReason: "session:void:session_cancelled" });
    expect(await frameAny(s)).toMatchObject({ outcome: "void", outcomeReason: "session_cancelled" });
    expect(await countUnexcusedHours(w.resident._id)).toBe(0);
  });

  test("so'rov `now` idan KEYIN boshlangan o'tish (rev T1 > T0) — void baribir yutadi", async () => {
    const w = await world();
    const s = await announce(w, addDays(todayUz(), 2));
    const t1 = new Date();
    await resolveSession(s._id, { now: t1, force: true, factsPort: storePort(SCANNED) });
    await SessionService.cancel(s._id, "Kasallik", w.teacher.user, { now: new Date(t1.getTime() - 1000) });
    expect((await rowsOf(w))[0].deletedAt).toBeTruthy();
    expect(await frameAny(s)).toMatchObject({ outcome: "void", cancelledAt: expect.any(Date) });
  });
});

describe("e4 — o'tish o'rtasidagi freym xatosi (ko'rik R3)", () => {
  test("2-freym CAS'i yiqildi — yozilgan qator egasining saqlangan soati baribir yangilanadi", async () => {
    const w = await world();
    const ids = [w.resident._id, (await w.mk("Rezident Ikki"))._id];
    const s = await announce(w, D(12));
    const original = Roster.findOneAndUpdate.bind(Roster);
    let cas = 0;
    jest.spyOn(Roster, "findOneAndUpdate").mockImplementation((filter, ...rest) => {
      if (filter.$or) cas += 1;
      if (filter.$or && cas === 2) throw new Error("transient");
      return original(filter, ...rest);
    });
    const out = await resolveSessionDays([D(12)], { now: NOW, force: true, factsPort: storePort(CLOSED) });
    expect(out).toMatchObject({ errors: 1, recounted: 2 });
    const counted = await Promise.all(ids.map((id) => countUnexcusedHours(id)));
    expect([...counted].sort((a, b) => a - b)).toEqual([0, 8]);
    expect(await Promise.all(ids.map(storedHours))).toEqual(counted);
  });

  test("qator yozilgach freym havolasi yiqildi — o'sha rezidentning saqlangan soati baribir yangilanadi (L4-Q26)", async () => {
    const w = await world();
    const s = await announce(w, D(13));
    const original = Roster.updateOne.bind(Roster);
    jest.spyOn(Roster, "updateOne").mockImplementation((filter, update, ...rest) => {
      if (update?.$set && "attendance" in update.$set) throw new Error("transient");
      return original(filter, update, ...rest);
    });
    const out = await resolveSession(s._id, { now: NOW, force: true, factsPort: storePort(CLOSED) });
    expect(out).toMatchObject({ errors: 1, recounted: 1 });
    expect(await rowsOf(w, { session: s._id, deletedAt: null })).toEqual([expect.objectContaining({ status: "absent", hours: 8 })]);
    expect(await storedHours(w.resident._id)).toBe(8);
  });
});

describe("e5 — yangi o'tish qatorni o'z freym CAS'idan KEYIN o'qiydi (ko'rik X1, L4-Q27)", () => {
  const race = async (s, older, newer) => {
    const gate = hold(Roster, "findOneAndUpdate", (f, u) => Boolean(f.$or) && u?.$set?.resolvedRev === T(2), { chain: true });
    const n = resolveSession(s._id, { now: new Date(T(2)), force: true, factsPort: storePort(newer) });
    await gate.arrived;
    const p = await resolveSession(s._id, { now: new Date(T(1)), force: true, factsPort: storePort(older) });
    gate.release();
    return { p, n: await n };
  };

  test("eski absent N o'qishidan oldin tushdi — N (unmeasured) uni yashiradi, soat 0", async () => {
    const w = await world();
    const s = await announce(w, D(14));
    const { p } = await race(s, CLOSED, NONE);
    expect(p).toMatchObject({ changed: 1, repaired: 0 });
    expect(await frameOf(s, w)).toMatchObject({ outcome: "unmeasured", resolvedRev: T(2), attendance: null });
    expect(await rowsOf(w, { deletedAt: null })).toHaveLength(0);
    expect(await countUnexcusedHours(w.resident._id)).toBe(0);
    expect(await storedHours(w.resident._id)).toBe(0);
  });

  test("eski yashirish N o'qishidan oldin tushdi — N (absent) qatorni tiklaydi, soat 8", async () => {
    const w = await world();
    const s = await announce(w, D(15));
    await resolveSession(s._id, { now: NOW, force: true, factsPort: storePort(CLOSED) });
    await race(s, NONE, CLOSED);
    expect(await frameOf(s, w)).toMatchObject({ outcome: "absent", resolvedRev: T(2) });
    expect(await rowsOf(w, { deletedAt: null })).toEqual([expect.objectContaining({ status: "absent", sessionRev: T(2) })]);
    expect(await countUnexcusedHours(w.resident._id)).toBe(8);
    expect(await storedHours(w.resident._id)).toBe(8);
  });
});

describe("e6 — tuzatish o'tishi bekor qilish bilan poygada (ko'rik X1 davomi, L4-Q28)", () => {
  test("tuzatish o'tishining qatori void o'qishidan KEYIN tushdi — keyingi tuzatish yashiradi", async () => {
    const w = await world();
    const s = await announce(w, addDays(todayUz(), 1));
    const rev = Date.now() - 60_000;
    const gate = holdAttendanceUpdate((f, u) => Boolean(f.$or) && u?.$set?.sessionRev === rev);
    const repair = resolveSession(s._id, { now: new Date(rev), force: true, factsPort: storePort(SCANNED), depth: 1 });
    await gate.arrived;
    await SessionService.cancel(s._id, "Kasallik", w.teacher.user);
    gate.release();
    expect(await repair).toMatchObject({ changed: 1, repaired: 1 });
    expect(await rowsOf(w, { deletedAt: null })).toHaveLength(0);
    expect(await Roster.findOne({ session: s._id }).lean()).toMatchObject({ outcome: "void", outcomeReason: "session_cancelled" });
  });
});

describe("e7 — roster chiqarishi va freym revizyasi (ko'rik RV2-B, L4-Q29/L4-Q30)", () => {
  const anyFrame = (s, w) => Roster.findOne({ session: s._id, resident: w.resident._id }).lean();
  const WITHDRAWN = { outcome: "void", outcomeReason: "withdrawn", cancelledAt: expect.any(Date) };
  const leaveCut = (w) => Resident.collection.updateOne({ _id: w.resident._id }, { $set: { expulsionOrderCreated: true } });

  test("freymni jonli yuklab CAS'da ushlangan o'tish orada chiqarilgan freymga yozmaydi — void qoladi, qator yo'q", async () => {
    const w = await world();
    const day = D(17);
    const s = await announce(w, day);
    const [older, newer] = [uzAt(day, "12:00"), uzAt(day, "12:01")];
    const gate = hold(Roster, "findOneAndUpdate", (f, u) => Boolean(f.$or) && u?.$set?.resolvedRev === newer.getTime(), { chain: true });
    const pass = resolveSession(s._id, { now: newer, force: true, factsPort: storePort(SCANNED) });
    await gate.arrived;
    await leaveCut(w);
    await resolveSession(s._id, { now: older, force: true, factsPort: storePort(SCANNED) });
    gate.release();
    expect(await pass).toMatchObject({ stale: 1, changed: 0, repaired: 0 });
    expect(await anyFrame(s, w)).toMatchObject({ ...WITHDRAWN, resolvedRev: older.getTime() });
    expect(await rowsOf(w, { deletedAt: null })).toHaveLength(0);
  });

  test("chiqaruvchi eski o'tishning void'i yangiroq o'tishga yutqazdi — tuzatish void yozadi, qator yashiriladi, soat 0", async () => {
    const w = await world();
    const day = D(16);
    const s = await announce(w, day);
    const [older, newer] = [uzAt(addDays(day, 1), "02:00"), uzAt(addDays(day, 1), "03:00")];
    const gate = hold(Resident, "distinct", () => true);
    const withdrawing = resolveSession(s._id, { now: older, force: true, factsPort: storePort(CLOSED) });
    await gate.arrived;
    expect(await resolveSession(s._id, { now: newer, force: true, factsPort: storePort(CLOSED) })).toMatchObject({ changed: 1 });
    expect(await storedHours(w.resident._id)).toBe(8);
    await leaveCut(w);
    gate.release();
    expect(await withdrawing).toMatchObject({ stale: 1, repaired: 1, recounted: 1 });
    expect(await anyFrame(s, w)).toMatchObject({ ...WITHDRAWN, resolvedRev: newer.getTime() + 1 });
    expect(await rowsOf(w, { deletedAt: null })).toHaveLength(0);
    expect(await countUnexcusedHours(w.resident._id)).toBe(0);
    expect(await storedHours(w.resident._id)).toBe(0);
  });

  test("boshqa rezidentga cheklangan o'tish (baho yechimi) chiqarsa — butun sessiyani yechadi: void, qator yo'q, soat 0", async () => {
    const w = await world();
    const day = D(15);
    const other = await w.mk("Rezident Ikki");
    const s = await announce(w, day);
    const [older, newer] = [uzAt(addDays(day, 1), "02:00"), uzAt(addDays(day, 1), "03:00")];
    const gate = hold(Resident, "distinct", () => true);
    const opts = { force: true, factsPort: storePort(CLOSED) };
    const withdrawing = resolveSession(s._id, { ...opts, now: older, residentIds: [other._id] });
    await gate.arrived;
    expect(await resolveSession(s._id, { ...opts, now: newer })).toMatchObject({ changed: 2 });
    expect(await storedHours(w.resident._id)).toBe(8);
    await leaveCut(w);
    gate.release();
    expect(await withdrawing).toMatchObject({ entries: 2, repaired: 1, recounted: 1 });
    expect(await anyFrame(s, w)).toMatchObject({ ...WITHDRAWN, resolvedRev: newer.getTime() + 1 });
    expect(await rowsOf(w, { deletedAt: null })).toHaveLength(0);
    expect(await storedHours(w.resident._id)).toBe(0);
  });
});

const GRADED = { lessonType: "maruza" };
const gradeReq = (w, s, who, score) =>
  request(app).put(`/api/residency-sessions/${s._id}/entries/${w.resident._id}/score`).set("Authorization", who.auth).send({ score });

describe("f — baho parallel `absent` ga o'tish bilan (darvoza)", () => {
  test("baho qatori ushlangan paytda absent — 409 state_changed, qator absent, ball null", async () => {
    const w = await world();
    const s = await announce(w, addDays(todayUz(), -1), GRADED);
    const port = storePort(SCANNED);
    jest.spyOn(samsFactsPort, "loadSessionFacts").mockImplementation(port.loadSessionFacts);
    await resolveSession(s._id, { force: true });
    expect((await rowsOf(w))[0].status).toBe("present");

    const gate = holdAttendanceUpdate((filter, update) => filter.status === "present" && "score" in (update?.$set ?? {}));
    const held = gradeReq(w, s, w.teacher, 8).then((r) => r);
    await gate.arrived;
    port.facts = CLOSED;
    await resolveSession(s._id, { now: new Date(Date.now() + 60_000), force: true });
    gate.release();
    const res = await held;
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe("state_changed");
    expect((await rowsOf(w))[0]).toMatchObject({ status: "absent", score: null });
  });
});

const presentSession = async () => {
  const w = await world();
  const s = await announce(w, addDays(todayUz(), -1), GRADED);
  const port = storePort(SCANNED);
  jest.spyOn(samsFactsPort, "loadSessionFacts").mockImplementation(port.loadSessionFacts);
  await resolveSession(s._id, { force: true });
  return { w, s, port };
};
const scores = async (w, s) => [(await rowsOf(w))[0].score, (await frameOf(s, w)).score];

describe("f2 — parallel baholar: qator va freym bir xil ball (ko'rik X3, L3-Q10)", () => {
  const race = async ({ w, s }, model, older, newer) => {
    const gate = hold(model, "updateOne", (f, u) => u?.$set?.score === older);
    const first = gradeReq(w, s, w.teacher, older).then((r) => r);
    await gate.arrived;
    const second = await gradeReq(w, s, w.office, newer);
    gate.release();
    const res = await first;
    return { statuses: [second.status, res.status, res.body.reason], scores: await scores(w, s) };
  };
  const LOST = [200, 409, "state_changed"];

  test("eski baho (7) freym yozuvida ushlandi, yangisi (8) to'liq o'tdi — eski 409, ikkalasida 8", async () => {
    const ctx = await presentSession();
    expect(await race(ctx, Roster, 7, 8)).toEqual({ statuses: LOST, scores: [8, 8] });
  });

  test("eski baho qator yozuvida ushlandi — yangisining ustidan yozmaydi (409), ikkalasida 8", async () => {
    const ctx = await presentSession();
    expect(await race(ctx, Attendance, 7, 8)).toEqual({ statuses: LOST, scores: [8, 8] });
  });

  test("eski baho freym yozuvida ushlangan paytda tozalash — ikkalasida null", async () => {
    const ctx = await presentSession();
    expect(await race(ctx, Roster, 7, null)).toEqual({ statuses: LOST, scores: [null, null] });
  });

  test("eski tozalash qator yozuvida ushlandi, yangi baho o'tdi — tozalash 409, ikkalasida 8", async () => {
    const ctx = await presentSession();
    expect(await race(ctx, Attendance, null, 8)).toEqual({ statuses: LOST, scores: [8, 8] });
  });
});

describe("f3 — proyeksiya freym bahosini baho revizyasi tartibida ko'chiradi (ko'rik RV2-A/R2, L3-Q11/L3-Q12)", () => {
  const absentScored = async () => {
    const { w, s, port } = await presentSession();
    expect((await gradeReq(w, s, w.teacher, 8)).status).toBe(200);
    port.facts = CLOSED;
    await resolveSession(s._id, { now: new Date(Date.now() + 60_000), force: true });
    expect((await rowsOf(w))[0]).toMatchObject({ status: "absent", score: null });
    expect(await frameOf(s, w)).toMatchObject({ outcome: "absent", score: 8 });
    port.facts = SCANNED;
    return { w, s };
  };
  const backToPresent = (s) => resolveSession(s._id, { now: new Date(Date.now() + 120_000), force: true });
  const final = async (w, s) => [(await rowsOf(w))[0].status, ...(await scores(w, s))];

  test("present ga kiritish yozuvi ushlangan paytda tozalash (200) — eski ball qatorga ko'chmaydi, ikkalasida null", async () => {
    const { w, s } = await absentScored();
    const gate = holdAttendanceUpdate((f, u) => u?.$set?.status === "present");
    const pass = backToPresent(s);
    await gate.arrived;
    expect((await gradeReq(w, s, w.teacher, null)).status).toBe(200);
    gate.release();
    expect(await pass).toMatchObject({ stale: 1, repaired: 1 });
    expect(await final(w, s)).toEqual(["present", null, null]);
  });

  test("o'tish qatorni o'qishda ushlangan (freym CAS'i ball 8 ni ko'rgan) — to'liq tozalashdan keyin ball ko'chmaydi", async () => {
    const { w, s } = await absentScored();
    const gate = hold(Attendance, "findOne", (f, p, o) => o?.includeDeleted === true && p === null && Boolean(f.session), { chain: true });
    const pass = backToPresent(s);
    await gate.arrived;
    expect((await gradeReq(w, s, w.teacher, null)).status).toBe(200);
    gate.release();
    await pass;
    expect(await final(w, s)).toEqual(["present", null, null]);
  });

  test("tozalashning freym yozuvi ushlangan paytda present ga qaytish — tozalash ikkala hujjatda yutadi (L3-Q12)", async () => {
    const { w, s } = await absentScored();
    const gate = hold(Roster, "updateOne", (f, u) => u?.$set?.score === null && "scoredAt" in u.$set);
    const cleared = gradeReq(w, s, w.teacher, null).then((r) => r);
    await gate.arrived;
    await backToPresent(s);
    gate.release();
    expect((await cleared).status).toBe(200);
    expect(await final(w, s)).toEqual(["present", null, null]);
  });

  test("baho o'tishi va yangiroq o'tish ikkalasi qator qo'shishda ushlangan — yutqazgan qo'shish bahoni o'chirmaydi", async () => {
    const w = await world();
    const s = await announce(w, addDays(todayUz(), -1), GRADED);
    jest.spyOn(samsFactsPort, "loadSessionFacts").mockImplementation(storePort(SCANNED).loadSessionFacts);
    const [own, newer] = holdSeq(Attendance, "updateOne", (f, u, o) => o?.upsert === true, 2);
    const graded = gradeReq(w, s, w.office, 8).then((r) => r);
    await own.arrived;
    const pass = resolveSession(s._id, { now: new Date(Date.now() + 5), force: true });
    await newer.arrived;
    own.release();
    expect((await graded).status).toBe(200);
    newer.release();
    expect(await pass).toMatchObject({ stale: 1 });
    expect(await final(w, s)).toEqual(["present", 8, 8]);
  });

  test("teng ms dagi baho va tozalash — tozalash freymni olgan bo'lsa qatorni ham oladi, ikkalasida null (L3-Q12)", async () => {
    const { w, s } = await presentSession();
    const at = new Date();
    const call = (score, who) => GradeService.gradeEntry({ sessionId: s._id, residentId: w.resident._id, score, user: who.user, now: at });
    const gate = hold(Roster, "updateOne", (f, u) => u?.$set?.score === 8);
    const graded = call(8, w.teacher).then(() => 200, (err) => err.statusCode);
    await gate.arrived;
    await expect(call(null, w.office)).resolves.toMatchObject({ score: null });
    gate.release();
    expect(await graded).toBe(409);
    expect(await final(w, s)).toEqual(["present", null, null]);
  });
});

describe("g — HTTP: baho (TZ:515) va davomat konteksti", () => {
  test("o'z ustozi: present → 200 (qator va freymda ball); null → tozalanadi", async () => {
    const w = await world();
    const s = await announce(w, addDays(todayUz(), -1), GRADED);
    jest.spyOn(samsFactsPort, "loadSessionFacts").mockImplementation(storePort(SCANNED).loadSessionFacts);
    const res = await gradeReq(w, s, w.teacher, 85);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Ball qo'yildi", outcome: "present", score: 85 });
    expect((await rowsOf(w))[0]).toMatchObject({ status: "present", score: 85, samsVerified: true });
    expect(await frameOf(s, w)).toMatchObject({ score: 85, scoredBy: w.teacher.user._id });

    const cleared = await gradeReq(w, s, w.teacher, null);
    expect(cleared.status).toBe(200);
    expect((await rowsOf(w))[0].score).toBeNull();
    expect((await frameOf(s, w)).score).toBeNull();
  });

  test("begona ustoz — 404; SAMS qatori yo'q (fakt yo'q) — 409 not_confirmed; kalitsiz tana — 400", async () => {
    const w = await world();
    const s = await announce(w, addDays(todayUz(), -1), GRADED);
    const foreign = await gradeReq(w, s, w.other, 8);
    expect(foreign.status).toBe(404);
    expect(foreign.body.reason).toBe("entry_not_found");
    const stub = await gradeReq(w, s, w.teacher, 8);
    expect(stub.status).toBe(409);
    expect(stub.body).toMatchObject({ reason: "not_confirmed", outcome: expect.stringMatching(/^(pending|unmeasured)$/) });
    expect(await rowsOf(w)).toHaveLength(0);
    const bad = await request(app).put(`/api/residency-sessions/${s._id}/entries/${w.resident._id}/score`).set("Authorization", w.teacher.auth).send({});
    expect(bad.status).toBe(400);
  });

  test("amaliy sessiya (TZ 4.5.6) — present bo'lsa ham 409 lesson_type_not_graded; RosterDTO har qatorda shu sabab", async () => {
    const w = await world();
    const s = await announce(w, addDays(todayUz(), -1));
    await resolveSession(s._id, { force: true, factsPort: storePort(SCANNED) });
    expect(await frameOf(s, w)).toMatchObject({ outcome: "present" });

    for (const score of [8, null]) {
      const res = await gradeReq(w, s, w.teacher, score);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        reason: "lesson_type_not_graded",
        message: "Amaliy mashg'ulotga har dars uchun ball qo'yilmaydi — oraliq nazorat orqali baholanadi",
      });
    }
    expect((await rowsOf(w))[0]).toMatchObject({ status: "present", score: null });
    expect(await frameOf(s, w)).toMatchObject({ score: null, scoredBy: null });

    const detail = await request(app).get(`/api/residency-sessions/${s._id}`).set("Authorization", w.teacher.auth);
    expect(detail.status).toBe(200);
    expect(detail.body.roster.map((r) => [r.state, r.scoreBlockedReason])).toEqual([["present", "lesson_type_not_graded"]]);
  });

  test("attendance-context — sonlar, qamrov va sababsiz soat", async () => {
    const w = await world();
    const days = [D(5), D(6), D(7)];
    for (const day of days) await announce(w, day);
    await Application.create({
      resident: w.resident._id, type: "other", reason: "Kasal", status: "tasdiqlangan", reviewedBy: w.office.user._id,
      fromDate: new Date(`${D(7)}T00:00:00.000Z`), toDate: new Date(`${D(7)}T00:00:00.000Z`),
    });
    const facts = (id, day) => (day === D(5) ? SCANNED(id, day) : CLOSED(id, day));
    await resolveSessionDays(days, { now: NOW, force: true, factsPort: storePort(facts) });
    const res = await request(app).get(`/api/residency-sessions/residents/${w.resident._id}/attendance-context`).set("Authorization", w.office.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      resident: { _id: String(w.resident._id), status: "oquvda", totalUnexcusedHours: 8, warningIssued: true },
      sessions: { total: 3, present: 1, absent: 1, excused: 1, unmeasured: 0, pending: 0 },
      coverage: { measured: 3, ratio: 1 },
    });
    const foreign = await request(app).get(`/api/residency-sessions/residents/${w.resident._id}/attendance-context`).set("Authorization", w.other.auth);
    expect(foreign.status).toBe(403);
  });
});

describe("h — eski `PUT /attendance` qo'riqchisi", () => {
  test("sessiya qatori — 409; qo'lda qator — 200; present sessiya qatorini sababli qilish — 409", async () => {
    const w = await world();
    const [sAbsent, sPresent] = [await announce(w, D(9)), await announce(w, D(10))];
    await resolveSession(sAbsent._id, { now: NOW, force: true, factsPort: storePort(CLOSED) });
    await resolveSession(sPresent._id, { now: NOW, force: true, factsPort: storePort(SCANNED) });
    const [absentRow] = await rowsOf(w, { session: sAbsent._id });
    const [presentRow] = await rowsOf(w, { session: sPresent._id });

    const put = (id, body) => request(app).put(`/api/attendance/${id}`).set("Authorization", w.office.auth).send(body);
    const locked = await put(absentRow._id, { hours: 2 });
    expect(locked.status).toBe(409);
    expect(locked.body.reason).toBe("session_row_readonly");

    const manual = await Attendance.create({ resident: w.resident._id, date: new Date(`${D(15)}T00:00:00.000Z`), status: "absent", hours: 2 });
    expect((await put(manual._id, { hours: 3 })).status).toBe(200);

    const excuse = await request(app).put(`/api/attendance/${presentRow._id}/approve-excuse`).set("Authorization", w.office.auth).send({ reason: "Sabab" });
    expect(excuse.status).toBe(409);
    expect(excuse.body.reason).toBe("session_row_not_absent");
    expect((await Attendance.findById(presentRow._id).lean()).status).toBe("present");
  });
});

describe("i — standart port, SAMS qatori yo'q (I3 ham, I2/I3 dan oldingi stub ham)", () => {
  test("butun kun sessiyalari: 0 qator; freymlar faqat pending/unmeasured", async () => {
    const w = await world();
    await announce(w, D(8));
    await announce(w, D(8), { lessonType: "maruza" });
    await resolveSessionDays([D(8)], { now: uzAt(D(8), "10:00"), force: true });
    expect((await Roster.find({ day: D(8) }).lean()).map((f) => f.outcome)).toEqual(["pending", "pending"]);
    await resolveSessionDays([D(8)], { now: NOW, force: true });
    expect((await Roster.find({ day: D(8) }).lean()).map((f) => [f.outcome, f.outcomeReason])).toEqual([
      ["unmeasured", "no_facts"],
      ["unmeasured", "no_facts"],
    ]);
    expect(await Attendance.collection.countDocuments({})).toBe(0);
  });
});
