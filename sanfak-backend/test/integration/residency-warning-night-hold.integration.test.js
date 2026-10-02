"use strict";

jest.mock("#system/notification/notification.service", () => ({
  ...jest.requireActual("#system/notification/notification.service"),
  notify: jest.fn().mockResolvedValue([]),
}));
jest.mock("#modules/4.05-residency/_services/autoAbsenceNotice", () => ({
  syncAbsenceNotices: jest.fn().mockResolvedValue({ issued: 0, revoked: 0, announced: 0 }),
}));

const UserModel = require("#modules/4.01-auth/user/user.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Notification = require("#system/notification/notification.model");
const { notify } = require("#system/notification/notification.service");
const { runExpulsionCheck, runExpulsionSweep } = require("#modules/4.05-residency/_services/expulsionCheck");
const { currentAcademicYearWindow } = require("#modules/4.05-residency/_services/unexcusedWindow");

const DAY = 24 * 3600 * 1000;
const WIN = currentAcademicYearWindow();
const uz = (hhmmss) => new Date(`2026-10-13T${hhmmss}+05:00`);
const settle = () => new Promise((r) => setTimeout(r, 100));
const warnings = () => Notification.countDocuments({ eventType: "residency_attendance_warning" });
const doc = (r) => Resident.findById(r._id).lean();

async function residentWith8h() {
  const user = await UserModel.create({ firstName: "Ali", lastName: "Valiyev", active: true });
  const r = await Resident.create({
    program: "ordinatura", fullName: "Valiyev Ali", courseNumber: 1, status: "oquvda", active: true, user: user._id,
  });
  await Attendance.insertMany(
    [1, 2, 3, 4].map((k) => ({
      resident: r._id, date: new Date(WIN.from.getTime() + k * DAY), status: "absent", hours: 2, active: true, lessonType: "amaliy",
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

beforeAll(() => Attendance.init());
beforeEach(() => notify.mockClear());
afterEach(() => jest.restoreAllMocks());

describe("I3-Q16=A — tungi ushlash va 08:00 chiqarish", () => {
  test("A — tunda ushlanadi, sweep bir marta chiqaradi, keyin qo'shilmaydi", async () => {
    const r = await residentWith8h();
    await runExpulsionCheck(r._id, { source: "sams", now: uz("01:35:00.000") });
    await settle();
    expect(await doc(r)).toMatchObject({ totalUnexcusedHours: 8, warningIssued: false });
    expect(await warnings()).toBe(0);
    expect(notify).not.toHaveBeenCalled();

    await runExpulsionSweep();
    await settle();
    const after = await doc(r);
    expect(after.warningIssued).toBe(true);
    expect(after.warningIssuedAt).toBeInstanceOf(Date);
    expect(await warnings()).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);

    await runExpulsionCheck(r._id, { source: "sams", now: uz("09:00:00.000") });
    await settle();
    expect(await warnings()).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  test("B — sweep'gacha soat tushsa hech narsa yuborilmaydi", async () => {
    const r = await residentWith8h();
    await runExpulsionCheck(r._id, { source: "sams", now: uz("01:35:00.000") });
    await Attendance.updateMany({ resident: r._id }, { $set: { status: "excused" } });
    await runExpulsionCheck(r._id, { source: "attendance", now: uz("07:00:00.000") });

    await runExpulsionSweep();
    await settle();
    expect(await doc(r)).toMatchObject({ totalUnexcusedHours: 0, warningIssued: false });
    expect(await warnings()).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("poygalar (darvoza bilan)", () => {
  test("R1 — ushlangan yozuv sweep chiqargan bayroqni bosib ketmaydi", async () => {
    const r = await residentWith8h();
    const { arrived, release } = holdFirst(Resident, "findByIdAndUpdate");
    const check = runExpulsionCheck(r._id, { source: "sams", now: uz("07:59:59.999") });
    await arrived;
    await runExpulsionSweep();
    release();
    await check;
    await settle();
    expect(await doc(r)).toMatchObject({ totalUnexcusedHours: 8, warningIssued: true });
    expect(await warnings()).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  test("R2 — sweep o'rtasidagi ushlangan tekshiruv takror yuborishga olib kelmaydi", async () => {
    const r = await residentWith8h();
    const { arrived, release } = holdFirst(Attendance, "find");
    const sweep = runExpulsionSweep();
    await arrived;
    await runExpulsionCheck(r._id, { source: "sams", now: uz("07:59:59.999") });
    release();
    await sweep;
    await settle();
    expect(await doc(r)).toMatchObject({ warningIssued: true });
    expect(await warnings()).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
