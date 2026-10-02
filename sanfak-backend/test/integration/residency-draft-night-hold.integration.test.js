"use strict";

jest.mock("#system/notification/notification.service", () => ({
  ...jest.requireActual("#system/notification/notification.service"),
  notify: jest.fn().mockResolvedValue([]),
}));
jest.mock("#modules/4.05-residency/_services/autoAbsenceNotice", () => ({
  syncAbsenceNotices: jest.fn().mockResolvedValue({ issued: 0, revoked: 0, announced: 0 }),
}));

const RoleModel = require("#modules/4.01-auth/role/role.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const Notification = require("#system/notification/notification.model");
const winston = require("#shared/winston.logger");
const { notify } = require("#system/notification/notification.service");
const { runExpulsionCheck, runExpulsionSweep } = require("#modules/4.05-residency/_services/expulsionCheck");
const { currentAcademicYearWindow } = require("#modules/4.05-residency/_services/unexcusedWindow");

const DAY = 24 * 3600 * 1000;
const WIN = currentAcademicYearWindow();
const uz = (hhmmss) => new Date(`2026-10-13T${hhmmss}+05:00`);
const settle = () => new Promise((r) => setTimeout(r, 100));
const doc = (r) => Resident.findById(r._id).lean();
const count = (eventType) => Notification.countDocuments({ eventType });
const OFFICE = "residency_expulsion_draft_office";
const RESIDENT = "residency_expulsion";
const WARNING = "residency_attendance_warning";
const HELD_72 = "72 soat loyihasi 08:00 sweep'gacha ushlab turildi";

async function residentWith80h() {
  const user = await UserModel.create({ firstName: "Ali", lastName: "Valiyev", active: true });
  const r = await Resident.create({
    program: "ordinatura", fullName: "Valiyev Ali", courseNumber: 1, status: "oquvda", active: true, user: user._id,
  });
  await Attendance.insertMany(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => ({
      resident: r._id, date: new Date(WIN.from.getTime() + k * DAY), status: "absent", hours: 8, active: true, lessonType: "amaliy",
    })),
  );
  return r;
}

function holdFirst(obj, method) {
  const original = obj[method].bind(obj);
  let release;
  let reached;
  const gate = new Promise((res) => {
    release = res;
  });
  const arrived = new Promise((res) => {
    reached = res;
  });
  jest.spyOn(obj, method).mockImplementationOnce(async (...args) => {
    reached();
    await gate;
    return original(...args);
  });
  return { arrived, release };
}

beforeAll(() => Promise.all([Attendance.init(), Order.init()]));
beforeEach(async () => {
  notify.mockClear();
  const role = await RoleModel.create({ title: "magistratura_bolim", scopeLevel: "global", active: true });
  await Promise.all(
    ["A", "B"].map((n) => UserModel.create({ firstName: n, lastName: "Bolim", role: role._id, active: true })),
  );
});
afterEach(() => jest.restoreAllMocks());

describe("N72-Q1=A — tungi ushlash va 08:00 sweep ochishi", () => {
  test("I-A — tunda hujjat ham, xabar ham yo'q; sweep `cron` bilan ochadi; kunduzgi tekshiruv qo'shmaydi", async () => {
    const r = await residentWith80h();
    await runExpulsionCheck(r._id, { source: "sams", now: uz("01:35:00.000") });
    await settle();
    expect(await Order.countDocuments({ resident: r._id })).toBe(0);
    expect(await doc(r)).toMatchObject({ expulsionOrderCreated: false, totalUnexcusedHours: 80, warningIssued: false });
    expect(await count(OFFICE)).toBe(0);
    expect(await count(RESIDENT)).toBe(0);

    await runExpulsionSweep();
    await settle();
    const orders = await Order.find({ resident: r._id }).lean();
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("loyiha");
    expect(orders[0].history[0]).toMatchObject({ action: "yaratildi", source: "cron" });
    expect(orders[0].noticesSentAt).toBeInstanceOf(Date);
    const after = await doc(r);
    expect(after.expulsionOrderCreated).toBe(true);
    expect(after.expulsionOrderCreatedAt).toEqual(orders[0].draftedAt);
    expect([await count(OFFICE), await count(RESIDENT), await count(WARNING)]).toEqual([2, 1, 1]);
    const warning = await Notification.findOne({ eventType: WARNING }).lean();
    const office = await Notification.find({ eventType: OFFICE }).lean();
    for (const n of office) expect(warning.createdAt.getTime()).toBeLessThanOrEqual(n.createdAt.getTime());

    await runExpulsionCheck(r._id, { source: "sams", now: uz("09:00:00.000") });
    await settle();
    expect(await Order.countDocuments({ resident: r._id })).toBe(1);
    expect(await Notification.countDocuments({})).toBe(4);
  });

  test("I-B — sweep'gacha soat tushsa loyiha umuman yaratilmaydi", async () => {
    const r = await residentWith80h();
    await runExpulsionCheck(r._id, { source: "sams", now: uz("01:35:00.000") });
    await Attendance.updateMany({ resident: r._id }, { $set: { status: "excused" } });
    await runExpulsionCheck(r._id, { source: "attendance", now: uz("07:00:00.000") });

    await runExpulsionSweep();
    await settle();
    expect(await Order.countDocuments({ resident: r._id })).toBe(0);
    expect(await doc(r)).toMatchObject({ expulsionOrderCreated: false, totalUnexcusedHours: 0 });
    expect([await count(OFFICE), await count(RESIDENT)]).toEqual([0, 0]);
  });

  test("I-C — qo'lda davomat (`attendance`) tunda ham darhol ochadi (ushlanmaydi)", async () => {
    const r = await residentWith80h();
    await runExpulsionCheck(r._id, { source: "attendance", now: uz("01:35:00.000") });
    await settle();
    const orders = await Order.find({ resident: r._id }).lean();
    expect(orders).toHaveLength(1);
    expect(orders[0].history[0]).toMatchObject({ action: "yaratildi", source: "attendance" });
    expect(await count(OFFICE)).toBe(2);
  });

  test("I-D — loyiha allaqachon ochiq: tungi tekshiruv jim, ko'rsatkich o'zgarmaydi (N72-Q4=A)", async () => {
    const r = await residentWith80h();
    await runExpulsionSweep();
    await settle();
    const before = await doc(r);
    expect(before.expulsionOrderCreated).toBe(true);

    const info = jest.spyOn(winston, "info");
    await runExpulsionCheck(r._id, { source: "sams", now: uz("01:35:00.000") });
    await settle();
    expect(info.mock.calls.map(([m]) => String(m)).filter((m) => m.includes(HELD_72))).toEqual([]);
    expect(await Order.countDocuments({ resident: r._id })).toBe(1);
    const after = await doc(r);
    expect(after.expulsionOrderCreated).toBe(true);
    expect(after.expulsionOrderCreatedAt).toEqual(before.expulsionOrderCreatedAt);
  });
});

describe("N72-Q6=A — poygalar (darvoza bilan)", () => {
  test("R3 — ushlangan yozuv sweep ochgan loyiha bayrog'ini bosib ketmaydi", async () => {
    const r = await residentWith80h();
    const { arrived, release } = holdFirst(Resident, "findByIdAndUpdate");
    const check = runExpulsionCheck(r._id, { source: "sams", now: uz("07:59:59.999") });
    await arrived;
    await runExpulsionSweep();
    release();
    await check;
    await settle();
    expect(await doc(r)).toMatchObject({ expulsionOrderCreated: true, warningIssued: true, totalUnexcusedHours: 80 });
    expect(await Order.countDocuments({ resident: r._id })).toBe(1);
    expect([await count(OFFICE), await count(WARNING)]).toEqual([2, 1]);
  });

  test("R4 — sweep o'rtasidagi ushlangan tekshiruv ikkinchi loyiha yoki xabar bermaydi", async () => {
    const r = await residentWith80h();
    const { arrived, release } = holdFirst(Attendance, "find");
    const sweep = runExpulsionSweep();
    await arrived;
    await runExpulsionCheck(r._id, { source: "sams", now: uz("07:59:59.999") });
    expect(await Order.countDocuments({ resident: r._id })).toBe(0);
    release();
    await sweep;
    await settle();
    expect(await Order.countDocuments({ resident: r._id })).toBe(1);
    expect([await count(OFFICE), await count(RESIDENT)]).toEqual([2, 1]);
  });
});
