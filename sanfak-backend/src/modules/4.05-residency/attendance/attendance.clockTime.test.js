"use strict";

const mockSave = jest.fn();
jest.mock("./attendance.model", () => {
  function Attendance(payload) {
    Object.assign(this, payload);
    Attendance.__built.push(payload);
    this.save = (...a) => mockSave(...a);
  }
  Attendance.__built = [];
  Attendance.ATTENDANCE_STATUSES = ["present", "absent", "excused"];
  Attendance.CLIENT_ATTENDANCE_STATUSES = ["present", "absent"];
  Attendance.RESIDENCY_LESSON_TYPES = ["amaliy", "maruza"];
  Attendance.findOne = jest.fn();
  Attendance.findById = jest.fn();
  Attendance.findOneAndUpdate = jest.fn();
  Attendance.exists = jest.fn();
  return Attendance;
});
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({ findById: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/expulsionCheck", () => ({
  runExpulsionCheck: jest.fn(),
  _notifyInBackground: jest.fn(),
  _dispatchInAppInBackground: jest.fn(),
}));
jest.mock("#modules/4.05-residency/residencySetting/residencySetting.service", () => ({
  getOrCreate: jest.fn(async () => ({ workDayFrom: "09:00", workDayTo: "14:00" })),
}));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const {
  createAttendanceSchema,
  updateAttendanceSchema,
  approveExcuseSchema,
} = require("./attendance.validation");
const Attendance = require("./attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Controller = require("./attendance.controller");

const RES_ID = "6a97de5a52685c2068a0a543";
const ROW_ID = "6a5a0acbd34b3c21a575d59d";
const TIMES = ["checkInTime", "checkOutTime"];

const create = (patch) =>
  createAttendanceSchema.validate({ resident: RES_ID, date: "2026-09-09", status: "absent", ...patch }, { abortEarly: false });
const update = (patch) => updateAttendanceSchema.validate(patch, { abortEarly: false });

const res = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const staff = { _id: "staff-1", role: { title: "magistratura_bolim", scopeLevel: "global" } };

beforeEach(() => {
  jest.clearAllMocks();
  Attendance.__built.length = 0;
  Attendance.findOne.mockResolvedValue(null);
  Attendance.findOneAndUpdate.mockResolvedValue({ resident: RES_ID });
  Resident.findById.mockResolvedValue({ _id: RES_ID, program: "ordinatura", group: null });
  mockSave.mockResolvedValue({});
});

describe("validator — vaqtlar jimgina tashlanadi (400 EMAS)", () => {
  it.each([
    ["to'liq juftlik", { checkInTime: "09:00", checkOutTime: "14:00" }],
    ["yaroqsiz format", { checkInTime: "aa:bb", checkOutTime: "25:99" }],
    ["yarim juftlik", { checkInTime: "09:00" }],
    ["teskari tartib", { checkInTime: "14:00", checkOutTime: "09:00" }],
    ["null / bo'sh satr", { checkInTime: null, checkOutTime: "" }],
  ])("%s — create ham, update ham", (_label, patch) => {
    for (const { error, value } of [create(patch), update({ score: 5, ...patch })]) {
      expect(error).toBeUndefined();
      for (const key of TIMES) expect(value).not.toHaveProperty(key);
    }
  });

  it("vaqtga tegmaydigan patch buzilmaydi", () => {
    expect(update({ status: "absent" })).toEqual({ value: { status: "absent" } });
  });

  it("`approveExcuse` vaqt maydonlarini QABUL QILMAYDI (avvalgidek)", () => {
    expect(approveExcuseSchema.validate({ reason: "Kasal", checkInTime: "09:00" }).error).toBeDefined();
    expect(approveExcuseSchema.validate({ reason: "Kasal" }).error).toBeUndefined();
  });
});

describe("controller — validator chetlab o'tilsa ham", () => {
  it("allowlistlarda vaqt yo'q", () => {
    for (const list of [Controller.CREATE_FIELDS, Controller.UPDATE_FIELDS]) {
      for (const key of TIMES) expect(list).not.toContain(key);
    }
  });

  it("POST — xom tanadagi vaqtlar qurilgan qatorga yetmaydi", async () => {
    const r = res();
    const body = { resident: RES_ID, date: "2026-09-02", status: "absent", checkInTime: "10:00", checkOutTime: "11:00" };
    await Controller.addAttendance({ user: staff, body }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(201);
    for (const key of TIMES) expect(Attendance.__built[0]).not.toHaveProperty(key);
  });

  it("🔴 PUT — ball oynasi SAQLANGAN vaqtni o'qiydi: so'rovdagi 10:00–11:00 15:00–16:00 qatorni o'tkazmaydi", async () => {
    Attendance.findById.mockResolvedValue({
      resident: RES_ID, status: "present", manualVerified: true, checkInTime: "15:00", checkOutTime: "16:00",
    });
    const r = res();
    const body = { score: 8, checkInTime: "10:00", checkOutTime: "11:00" };
    await Controller.updateAttendance({ user: staff, params: { id: ROW_ID }, body }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].message).toContain("09:00–14:00");
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("PUT — saqlangan vaqt kesishsa ball yoziladi, yozuvda vaqt yo'q", async () => {
    Attendance.findById.mockResolvedValue({
      resident: RES_ID, status: "present", manualVerified: true, checkInTime: "08:30", checkOutTime: "09:30",
    });
    const r = res();
    const body = { score: 8, checkInTime: "15:00", checkOutTime: "16:00" };
    await Controller.updateAttendance({ user: staff, params: { id: ROW_ID }, body }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    const [, written] = Attendance.findOneAndUpdate.mock.calls[0];
    expect(written).toMatchObject({ score: 8 });
    for (const key of TIMES) expect(written).not.toHaveProperty(key);
  });
});
