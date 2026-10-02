"use strict";

const H = require("./helpers/samsIngest");
const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { handleError } = require("#shared/error");
const winston = require("#shared/winston.logger");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
const Group = require("#references/group/group.model");
const Science = require("#references/science/science.model");
const Notification = require("#system/notification/notification.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Application = require("#modules/4.05-residency/residentApplication/residentApplication.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const Resolution = require("#modules/4.05-residency/_services/sessionResolution");
const samsFactsPort = require("#modules/4.05-residency/_services/samsFactsPort");
const { ingestPacket } = require("#modules/4.05-residency/samsIngest/samsIngest.service");
const OutageService = require("#modules/4.05-residency/residencySamsOutage/residencySamsOutage.service");
const Outage = require("#modules/4.05-residency/residencySamsOutage/residencySamsOutage.model");
const { runSamsMonitorTick } = require("#modules/4.05-residency/samsIngest/samsMonitorTick");
const { scheduleSessionResolution, _idle } = require("#modules/4.05-residency/_services/samsPresenceSync");
const { fanOut } = require("#modules/4.05-residency/_services/sessionRoster");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");
const { currentAcademicYearWindow } = require("#modules/4.05-residency/_services/unexcusedWindow");
const { todayUz } = require("#modules/4.05-residency/_services/sessionDay");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");
const { GRANTS } = require("../../seed/residency-roles.seed");

const app = express();
app.use(bodyParser.json());
app.use("/api/residency-sessions", require("#modules/4.05-residency/residencySession/residencySession.routes"));
app.use("/api/attendance", require("#modules/4.05-residency/attendance/attendance.routes"));
app.use((err, req, res, next) => handleError(err, res));

const YM = (() => {
  const d = new Date(currentAcademicYearWindow().from);
  d.setUTCMonth(d.getUTCMonth() + 2);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
})();
const D = (n) => `${YM}-${String(n).padStart(2, "0")}`;
const uzAt = (day, hhmm) => new Date(`${day}T${hhmm}:00.000+05:00`);
const NOW = uzAt(D(20), "08:00");
const WEEK = { from: D(13), to: D(19) };
const PINS = ["30101990000111", "30101990000122", "30101990000133"];

const scan = (attendId, day, accessTime, exitTime) => ({
  attendId, date: day, accessTime, exitTime, deviceType: [{ device: 1, type: 1 }, { device: 1, type: 2 }], lated: 0, earlyLeft: 0,
});
const personOf = (pin, records = [], over = {}) => ({ ...H.person(pin, D(1), records), ...over });
const packetOf = ({ people, window = WEEK, emittedAt = new Date(NOW.getTime() - 60_000), trigger }) =>
  H.packet({ window, emittedAt, trigger, tenants: [H.tenant("clinicA", D(1), people, window)] });

let clock = NOW;
const realResolveDays = Resolution.resolveSessionDays;
async function ingestAt(packet, now = NOW) {
  clock = now;
  await ingestPacket(packet, now);
  await _idle();
}
const settle = () => new Promise((r) => setTimeout(r, 100));

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
async function world(count = 1) {
  const [group, science] = [await Group.create({ title: "ORD-1" }), await Science.create({ title: "Terapiya" })];
  const [teacher, office] = [await actor("klinik_ustoz"), await actor("magistratura_bolim")];
  const residents = [];
  for (const pin of PINS.slice(0, count)) {
    residents.push(await Resident.create({
      program: "ordinatura", fullName: `Rezident ${pin.slice(-3)}`, jshshir: pin, courseNumber: 1, group: group._id,
      groupTitle: "ORD-1", status: "oquvda", active: true, supervisor: teacher.user._id,
    }));
  }
  return { group, science, teacher, office, residents, r: residents[0] };
}
async function announce(w, day, lessonType = "amaliy") {
  const s = await Session.create({
    day, group: w.group._id, groupTitle: "ORD-1", science: w.science._id, scienceTitle: "Terapiya", lessonType,
    hours: 8, announcedBy: w.teacher.user._id, rosterScope: "supervised", status: "announced",
  });
  await fanOut(s._id);
  return s;
}
const liveRows = (r) => Attendance.find({ resident: r._id, session: { $ne: null } }).sort({ date: 1, lessonType: 1 }).lean();
const residentDoc = (r) => Resident.collection.findOne({ _id: r._id });
const frameOf = (s, r) => Roster.findOne({ session: s._id, resident: r._id, cancelledAt: null }).lean();

beforeAll(() => Promise.all([Attendance.init(), Session.init(), Roster.init(), Order.init(), SamsPresence.init(), SamsOrgDay.init()]));

describe("I3 — soxta soat: paket / uzilish → yechim → 6/72 soat", () => {
  beforeEach(() => {
    clock = NOW;
    jest.spyOn(Resolution, "resolveSessionDays").mockImplementation((days, o) => realResolveDays(days, { ...o, now: clock }));
  });
  afterEach(async () => {
    await _idle();
    await settle();
    jest.restoreAllMocks();
  });

  const nineSessions = async (w) => {
    for (let n = 13; n <= 19; n += 1) await announce(w, D(n));
    await announce(w, D(18), "maruza");
    await announce(w, D(19), "maruza");
  };

  test("A — yopilgan hafta, skansiz: 72 soat, BITTA loyiha (`sams`); replay — yangi hech narsa yo'q", async () => {
    const w = await world();
    await nineSessions(w);
    const packet = packetOf({ people: [personOf(PINS[0])] });
    await ingestAt(packet);

    const rows = await liveRows(w.r);
    expect(rows).toHaveLength(9);
    expect(rows.every((x) => x.status === "absent" && x.hours === 8 && !x.deletedAt && x.samsVerified === false)).toBe(true);
    expect(await countUnexcusedHours(w.r._id)).toBe(72);
    const orders = await Order.find({ resident: w.r._id }).lean();
    expect(orders.map((o) => [o.status, o.history[0].action, o.history[0].source])).toEqual([["loyiha", "yaratildi", "sams"]]);
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 72, warningIssued: true, expulsionOrderCreated: true });
    await settle();
    const notices = await Notification.countDocuments({});
    expect(notices).toBeGreaterThan(0);

    for (let i = 1; i <= 3; i += 1) await ingestAt(packet, new Date(NOW.getTime() + i * 60_000));
    clock = new Date(NOW.getTime() + 5 * 60_000);
    await scheduleSessionResolution({ days: [D(13), D(19)] });
    await _idle();
    await settle();
    expect((await liveRows(w.r)).map((x) => String(x._id))).toEqual(rows.map((x) => String(x._id)));
    expect(await Order.countDocuments({ resident: w.r._id })).toBe(1);
    expect(await Notification.countDocuments({})).toBe(notices);
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 72, warningIssued: true });
  });

  test("B — uzilish oynasi (majburiy): 64 soat, loyiha `sams` bilan bekor; bekor qilinsa — 72 qaytadi", async () => {
    const w = await world();
    await nineSessions(w);
    await ingestAt(packetOf({ people: [personOf(PINS[0])] }));
    expect(await countUnexcusedHours(w.r._id)).toBe(72);

    clock = uzAt(D(22), "09:00");
    const outage = await OutageService.create({ from: D(13), to: D(13), dbname: null, reason: "Turniket ishlamadi" }, w.office.user, clock);
    await _idle();
    expect(await countUnexcusedHours(w.r._id)).toBe(64);
    const [order] = await Order.find({ resident: w.r._id }).lean();
    expect(order.status).toBe("bekor_qilingan");
    expect(order.history.at(-1)).toMatchObject({ action: "bekor_qilindi", source: "sams", hours: 64 });
    const hidden = await Attendance.findOne({ resident: w.r._id, date: new Date(`${D(13)}T00:00:00.000Z`) }, null, { includeDeleted: true }).lean();
    expect(hidden.deletionReason).toBe("session:unmeasured:outage_window");
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: null, resolutionAttempts: 1 });

    clock = uzAt(D(22), "10:00");
    const g = {};
    g.released = new Promise((r) => (g.release = r));
    Resolution.resolveSessionDays.mockImplementationOnce(async (days, o) => {
      await g.released;
      return realResolveDays(days, { ...o, now: clock });
    });
    await OutageService.cancel(outage._id, "Xato kiritilgan", w.office.user, clock);
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: clock, resolutionAttempts: 1 });
    g.release();
    await _idle();
    expect(await countUnexcusedHours(w.r._id)).toBe(72);
    expect(await Order.countDocuments({ resident: w.r._id, status: "loyiha" })).toBe(1);
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: null });
  });

  test("B2 — majburiy o'tish yiqildi: oddiy trafik eski kunni tuzatmaydi; monitor tiki qayta urinadi → 64 soat (I3-Q10)", async () => {
    const w = await world();
    await nineSessions(w);
    await ingestAt(packetOf({ people: [personOf(PINS[0])] }));
    expect(await countUnexcusedHours(w.r._id)).toBe(72);

    clock = uzAt(D(22), "09:00");
    Resolution.resolveSessionDays.mockImplementationOnce(async () => {
      throw new Error("mongo down");
    });
    const outage = await OutageService.create({ from: D(13), to: D(13), dbname: null, reason: "Turniket ishlamadi" }, w.office.user, clock);
    await _idle();
    expect(await countUnexcusedHours(w.r._id)).toBe(72);
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: clock, resolutionAttempts: 1 });

    const today = { from: D(22), to: D(22) };
    await ingestAt(packetOf({ people: [personOf(PINS[0])], window: today, emittedAt: uzAt(D(22), "09:05") }), uzAt(D(22), "09:06"));
    expect(await countUnexcusedHours(w.r._id)).toBe(72);

    clock = uzAt(D(22), "09:07");
    await expect(runSamsMonitorTick(clock)).resolves.toBe(true);
    await _idle();
    expect(await countUnexcusedHours(w.r._id)).toBe(64);
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: null, resolutionAttempts: 2 });
    const hidden = await Attendance.findOne({ resident: w.r._id, date: new Date(`${D(13)}T00:00:00.000Z`) }, null, { includeDeleted: true }).lean();
    expect(hidden.deletionReason).toBe("session:unmeasured:outage_window");

    clock = uzAt(D(22), "10:00");
    await OutageService.cancel(outage._id, "Xato kiritilgan", w.office.user, clock);
    await _idle();
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: null, resolutionAttempts: 1 });
    expect(await countUnexcusedHours(w.r._id)).toBe(72);
  });

  test("B3 — o'tish qatorni yashirgach yiqildi: tik qayta urinishi oyna kunlarini qayta hisoblaydi → saqlangan 56, loyiha bekor (I3-Q12)", async () => {
    const w = await world();
    await nineSessions(w);
    await ingestAt(packetOf({ people: [personOf(PINS[0])] }));
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 72 });

    const find = Session.find.bind(Session);
    let failed = false;
    jest.spyOn(Session, "find").mockImplementation((filter, ...rest) => {
      if (filter?.day === D(20) && !failed) {
        failed = true;
        throw new Error("transient read");
      }
      return find(filter, ...rest);
    });
    const info = jest.spyOn(winston, "info");
    clock = uzAt(D(22), "09:00");
    const outage = await OutageService.create({ from: D(19), to: D(20), dbname: null, reason: "Turniket ishlamadi" }, w.office.user, clock);
    await _idle();
    expect(failed).toBe(true);
    expect(await countUnexcusedHours(w.r._id)).toBe(56);
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 72 });
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: clock, resolutionAttempts: 1 });

    clock = uzAt(D(22), "09:07");
    await expect(runSamsMonitorTick(clock)).resolves.toBe(true);
    await _idle();
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 56 });
    const [order] = await Order.find({ resident: w.r._id }).lean();
    expect([order.status, order.history.at(-1)]).toEqual(["bekor_qilingan", expect.objectContaining({ action: "bekor_qilindi", source: "sams", hours: 56 })]);
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: null, resolutionAttempts: 2 });
    expect(info.mock.calls.map(([m]) => String(m))).toContain(
      `[4.5 samsOutage] qayta urinish qayta hisobi outage=${outage._id} days=${D(19)}..${D(20)} (2) residents=1 failed=0`,
    );
  });

  test("B4 — o'tish xatosiz, lekin qayta hisob yiqildi: token qoladi; tik qayta urinishi saqlangan soatni tuzatadi (I3-Q12)", async () => {
    const w = await world();
    await nineSessions(w);
    await ingestAt(packetOf({ people: [personOf(PINS[0])] }));

    jest.spyOn(Resident, "findByIdAndUpdate").mockImplementationOnce(() => Promise.reject(new Error("write failed")));
    clock = uzAt(D(22), "09:00");
    const outage = await OutageService.create({ from: D(13), to: D(13), dbname: null, reason: "Turniket ishlamadi" }, w.office.user, clock);
    await _idle();
    expect(await countUnexcusedHours(w.r._id)).toBe(64);
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 72 });
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: clock, resolutionAttempts: 1 });

    clock = uzAt(D(22), "09:07");
    await expect(runSamsMonitorTick(clock)).resolves.toBe(true);
    await _idle();
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 64 });
    expect(await Order.countDocuments({ resident: w.r._id, status: "loyiha" })).toBe(0);
    expect(await Outage.findById(outage._id).lean()).toMatchObject({ resolutionPendingSince: null, resolutionAttempts: 2 });
  });

  test("C — 18:00 dagi tik: kun yopilmagan (0 soat); kechalik paket yopadi; eski tik replay'i qayta ochmaydi", async () => {
    const w = await world();
    const s = await announce(w, D(19), "maruza");
    const day = { from: D(19), to: D(19) };
    const tick = packetOf({ people: [personOf(PINS[0])], window: day, emittedAt: uzAt(D(19), "18:00") });
    await ingestAt(tick, uzAt(D(19), "18:01"));
    expect(await frameOf(s, w.r)).toMatchObject({ outcome: "pending", outcomeReason: "awaiting_close" });
    expect(await liveRows(w.r)).toHaveLength(0);
    expect(await residentDoc(w.r)).toMatchObject({ warningIssued: false });

    await ingestAt(packetOf({ people: [personOf(PINS[0])], window: day, emittedAt: uzAt(D(20), "00:30") }), uzAt(D(20), "00:31"));
    expect(await frameOf(s, w.r)).toMatchObject({ outcome: "absent" });
    expect(await countUnexcusedHours(w.r._id)).toBe(8);
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 8, warningIssued: false });
    await settle();
    const warnings = ["residency_attendance_warning", "residency_attendance_warning_supervisor"];
    expect(await Notification.countDocuments({ eventType: { $in: warnings } })).toBe(0);

    await ingestAt(tick, uzAt(D(20), "00:40"));
    expect(await frameOf(s, w.r)).toMatchObject({ outcome: "absent" });
    expect(await countUnexcusedHours(w.r._id)).toBe(8);
  });

  test("D — bo'lim sababli qilgan qator yangi paketdan keyin ham excused", async () => {
    const w = await world();
    await announce(w, D(18), "maruza");
    const people = [personOf(PINS[0])];
    await ingestAt(packetOf({ people }));
    const [row] = await liveRows(w.r);
    const res = await request(app).put(`/api/attendance/${row._id}/approve-excuse`).set("Authorization", w.office.auth).send({ reason: "Tasdiqlandi" });
    expect(res.status).toBe(200);

    await ingestAt(packetOf({ people, emittedAt: new Date(NOW.getTime() + 60_000) }), new Date(NOW.getTime() + 120_000));
    expect(await liveRows(w.r)).toEqual([expect.objectContaining({ _id: row._id, status: "excused", excuseReason: "Tasdiqlandi" })]);
    expect(await countUnexcusedHours(w.r._id)).toBe(0);
  });

  test("E — tasdiqlangan ariza qoplagan kun: SAMS absent → excused (ariza bilan), soat 0", async () => {
    const w = await world();
    await announce(w, D(17), "maruza");
    const a = await Application.create({
      resident: w.r._id, type: "other", reason: "Kasal", status: "tasdiqlangan", reviewedBy: w.office.user._id,
      fromDate: new Date(`${D(17)}T00:00:00.000Z`), toDate: new Date(`${D(17)}T00:00:00.000Z`),
    });
    await ingestAt(packetOf({ people: [personOf(PINS[0])] }));
    const [row] = await liveRows(w.r);
    expect(row).toMatchObject({ status: "excused", excuseReason: "Kasal" });
    expect(String(row.application)).toBe(String(a._id));
    expect(await countUnexcusedHours(w.r._id)).toBe(0);
    expect(await residentDoc(w.r)).toMatchObject({ warningIssued: false });
  });

  test("R — darvoza: o'tish eski faktni o'qib ushlangan paytda yangi paket keldi — navbatdagi o'tish yangisini yozadi", async () => {
    const w = await world();
    const s = await announce(w, D(18), "maruza");
    const original = samsFactsPort.loadSessionFacts;
    const g = {};
    g.released = new Promise((r) => (g.release = r));
    g.arrived = new Promise((r) => (g.reached = r));
    jest.spyOn(samsFactsPort, "loadSessionFacts").mockImplementationOnce(async (q) => {
      const facts = await original(q);
      g.reached();
      await g.released;
      return facts;
    });
    await ingestPacket(packetOf({ people: [personOf(PINS[0])] }), NOW);
    await g.arrived;

    clock = new Date(NOW.getTime() + 120_000);
    const late = packetOf({ people: [personOf(PINS[0], [scan("a1", D(18), "08:30", "09:30")])], emittedAt: new Date(NOW.getTime() + 60_000) });
    await ingestPacket(late, clock);
    expect(await frameOf(s, w.r)).toMatchObject({ outcome: "pending" });
    g.release();
    await _idle();

    expect(await frameOf(s, w.r)).toMatchObject({ outcome: "present", resolvedRev: clock.getTime() });
    expect(await liveRows(w.r)).toEqual([expect.objectContaining({ status: "present", checkInTime: "08:30", checkOutTime: "09:30" })]);
    expect(await countUnexcusedHours(w.r._id)).toBe(0);
    expect(await residentDoc(w.r)).toMatchObject({ totalUnexcusedHours: 0 });
  });

  test("o'lchanmagan kun (smenasiz) hisobga kirmaydi; sessiya dars kalitidagi qo'lda qatorga tegilmaydi", async () => {
    const w = await world(2);
    const [r1, r2] = w.residents;
    const s = await announce(w, D(16), "maruza");
    const manual = await Attendance.create({
      resident: r2._id, date: new Date(`${D(16)}T00:00:00.000Z`), science: w.science._id, lessonType: "maruza", status: "absent", hours: 2,
    });
    const warn = jest.spyOn(winston, "warn");
    const error = jest.spyOn(winston, "error");
    const logged = (spy, text) => spy.mock.calls.some(([m]) => String(m).includes(text));
    await ingestAt(packetOf({ people: [personOf(PINS[0], [], { hasShift: false }), personOf(PINS[1])] }));

    expect(await frameOf(s, r1)).toMatchObject({ outcome: "unmeasured", outcomeReason: "no_schedule" });
    expect(await Attendance.countDocuments({ resident: r1._id })).toBe(0);
    expect(await countUnexcusedHours(r1._id)).toBe(0);

    expect(await frameOf(s, r2)).toMatchObject({ outcome: "absent" });
    await expect(scheduleSessionResolution({ days: [D(16)] })).resolves.toMatchObject({ errors: 0 });
    await _idle();
    const rows = await Attendance.find({ resident: r2._id }, null, { includeDeleted: true }).lean();
    expect(rows.map((x) => [String(x._id), x.session ?? null, x.status, x.hours, x.updatedAt.getTime()])).toEqual([
      [String(manual._id), null, "absent", 2, manual.updatedAt.getTime()],
    ]);
    expect(await countUnexcusedHours(r2._id)).toBe(2);
    expect([logged(warn, "qo'lda yozilgan dars bor — o'tkazildi"), logged(error, "dars kaliti to'qnashuvi")]).toEqual([true, false]);
  });

  test("F — muzlatilgan kun: resend shaklidagi paket 7 kundan eski sessiyani yechmaydi (I3-Q6, L4-Q11)", async () => {
    const w = await world();
    const s = await announce(w, D(10), "maruza");
    const window = { from: D(10), to: D(19) };
    await ingestAt(packetOf({ people: [personOf(PINS[0])], window, trigger: "resend" }));

    expect(await SamsPresence.countDocuments({ resident: w.r._id, day: D(10), measured: true })).toBe(1);
    expect(await frameOf(s, w.r)).toMatchObject({ outcome: "pending", resolvedRev: null });
    expect(await liveRows(w.r)).toHaveLength(0);
    expect(await countUnexcusedHours(w.r._id)).toBe(0);
  });
});

describe("H — real soat: HTTP ingest → fon yechimi → sessiya bahosi", () => {
  afterEach(async () => {
    await _idle();
    await settle();
  });

  test("kesishma (08:30–09:30) — present, vaqtlar serverdan, baho 200; kesishmasiz (15:00–16:00) — 409", async () => {
    const w = await world(2);
    const [r1, r2] = w.residents;
    const day = addDays(todayUz(), -2);
    const s = await announce(w, day, "maruza");
    const people = [
      H.person(PINS[0], H.D(-30), [scan("a1", day, "08:30", "09:30")]),
      H.person(PINS[1], H.D(-30), [scan("a2", day, "15:00", "16:00")]),
    ];
    const res = await H.ingest(H.packet({ tenants: [H.tenant("clinicA", H.D(-30), people)] }));
    expect(res.status).toBe(200);
    await _idle();

    expect(await frameOf(s, r1)).toMatchObject({ outcome: "present", samsFirstIn: "08:30", samsLastOut: "09:30" });
    expect(await liveRows(r1)).toEqual([expect.objectContaining({ status: "present", samsVerified: true, checkInTime: "08:30", checkOutTime: "09:30" })]);
    expect(await frameOf(s, r2)).toMatchObject({ outcome: "absent", outcomeReason: "no_overlap" });

    const grade = (r) => request(app).put(`/api/residency-sessions/${s._id}/entries/${r._id}/score`).set("Authorization", w.teacher.auth).send({ score: 8 });
    expect((await grade(r1)).status).toBe(200);
    const denied = await grade(r2);
    expect([denied.status, denied.body.reason]).toEqual([409, "not_confirmed"]);
  });
});
