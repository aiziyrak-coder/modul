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
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  findById: jest.fn(),
}));
jest.mock("#modules/4.05-residency/_services/expulsionCheck", () => ({
  runExpulsionCheck: jest.fn(),
  _notifyInBackground: jest.fn(),
  _dispatchInAppInBackground: jest.fn(),
}));
jest.mock("#modules/4.05-residency/residencySetting/residencySetting.service", () => ({
  getOrCreate: jest.fn(async () => ({ workDayFrom: "09:00", workDayTo: "14:00" })),
}));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const fs = require("fs");
const path = require("path");
const V = require("./attendance.validation");
const Attendance = require("./attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Controller = require("./attendance.controller");

const RES_ID = "6a97de5a52685c2068a0a543";
const ROW_ID = "6a5a0acbd34b3c21a575d59d";
const OTHER = "6a5a0acbd34b3c21a575d5aa";

const NOT_WRITABLE = ["teacher", "teacherName", "samsVerified", "manualVerified", "checkInTime", "checkOutTime"];
const schemaKeys = (schema) =>
  Object.keys(schema.describe().keys).filter((k) => !NOT_WRITABLE.includes(k));
const sorted = (list) => [...list].sort();

const res = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const staff = { _id: "staff-1", role: { title: "magistratura_bolim", scopeLevel: "global" } };
const putReq = (body) => ({ user: staff, params: { id: ROW_ID }, body });
const postReq = (body) => ({
  user: staff,
  body: { resident: RES_ID, date: "2026-09-02", status: "absent", ...body },
});
const asProgram = (program) =>
  Resident.findById.mockResolvedValue({ _id: RES_ID, program, group: null });
const asRow = (row) => Attendance.findById.mockResolvedValue({ resident: RES_ID, ...row });
const updateArg = () => Attendance.findOneAndUpdate.mock.calls[0][1];
const filterArg = () => Attendance.findOneAndUpdate.mock.calls[0][0];
const rejected = (next) => next.mock.calls[0]?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  Attendance.__built.length = 0;
  Attendance.findOne.mockResolvedValue(null);
  Attendance.findOneAndUpdate.mockResolvedValue({ resident: RES_ID });
  Resident.findById.mockResolvedValue({ _id: RES_ID, program: "magistratura", group: null });
  mockSave.mockResolvedValue({});
});

describe("allowlist ↔ Joi sxemasi pariteti", () => {
  test("CREATE_FIELDS = create sxemasi kalitlari (strip qilinganlarsiz)", () => {
    expect(sorted(Controller.CREATE_FIELDS)).toEqual(sorted(schemaKeys(V.createAttendanceSchema)));
  });

  test("UPDATE_FIELDS = update sxemasi kalitlari (strip qilinganlarsiz)", () => {
    expect(sorted(Controller.UPDATE_FIELDS)).toEqual(sorted(schemaKeys(V.updateAttendanceSchema)));
  });

  test("🔴 `{ ...req.body }` spread controller'da qaytmaydi", () => {
    const src = fs.readFileSync(path.join(__dirname, "attendance.controller.js"), "utf8");
    expect(src).not.toMatch(/=\s*\{\s*\.\.\.req\.body\s*\}/);
  });
});

describe("updateAttendance — faqat allowlist bazaga yetadi", () => {
  test("🔴 audit/bog'lanish maydonlari (validator chetlab o'tilsa ham) yozilmaydi", async () => {
    Attendance.findById.mockResolvedValue({ resident: RES_ID, status: "absent" });
    const junk = {
      samsVerified: true,
      teacher: OTHER,
      teacherName: "Soxta",
      application: OTHER,
      excuseApprovedBy: OTHER,
      active: false,
      manualVerifiedBy: OTHER,
      manualVerifiedAt: new Date(0),
      resident: OTHER,
      date: "2020-01-01",
      deletedAt: new Date(0),
    };
    const r = res();
    await Controller.updateAttendance(putReq({ status: "absent", hours: 4, ...junk }), r, jest.fn());

    expect(r.status).toHaveBeenCalledWith(200);
    const [, update] = Attendance.findOneAndUpdate.mock.calls[0];
    expect(update).toEqual({ status: "absent", hours: 4, late: false, lateMinutes: null });
  });

  test("ruxsat etilgan maydonlar avvalgidek o'tadi", async () => {
    Attendance.findById.mockResolvedValue({ resident: RES_ID, status: "absent" });
    const body = { lessonType: "amaliy", excuseReason: "x", fromDate: "2026-09-01" };
    await Controller.updateAttendance(putReq(body), res(), jest.fn());

    const [, update] = Attendance.findOneAndUpdate.mock.calls[0];
    expect(update).toMatchObject(body);
  });
});

describe("validator — `samsVerified` server-only (D-PRE)", () => {
  test.each([true, false, "ha"])("🔴 create: %p JIMGINA tashlanadi (400 EMAS)", (v) => {
    const { error, value } = V.createAttendanceSchema.validate({
      resident: RES_ID,
      date: "2026-09-02",
      status: "absent",
      samsVerified: v,
    });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty("samsVerified");
  });

  test("🔴 update: tashlanadi", () => {
    const { error, value } = V.updateAttendanceSchema.validate({ score: 5, samsVerified: true });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty("samsVerified");
  });

  test("`manualVerified` avvalgidek boolean sifatida tekshiriladi", () => {
    expect(V.updateAttendanceSchema.validate({ manualVerified: true }).value).toEqual({
      manualVerified: true,
    });
    expect(V.updateAttendanceSchema.validate({ manualVerified: "abc" }).error).toBeDefined();
  });
});

describe("addAttendance — «Keldi» dalili", () => {
  test("🔴 ordinatura present + qo'lda tasdiq → 400 present_requires_sams, hech narsa yozilmaydi", async () => {
    asProgram("ordinatura");
    const next = jest.fn();
    const r = res();
    await Controller.addAttendance(postReq({ status: "present", manualVerified: true }), r, next);

    expect(rejected(next)).toMatchObject({ statusCode: 400, meta: { reason: "present_requires_sams" } });
    expect(r.status).not.toHaveBeenCalled();
    expect(Attendance.__built).toHaveLength(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("🔴 ordinatura absent + xom SAMS/qo'lda bayroqlar → payload'ga yetmaydi", async () => {
    asProgram("ordinatura");
    const body = { samsVerified: true, manualVerified: true };
    await Controller.addAttendance(postReq(body), res(), jest.fn());

    const built = Attendance.__built[0];
    expect(built).not.toHaveProperty("samsVerified");
    expect(built).not.toHaveProperty("manualVerified");
    expect(built).not.toHaveProperty("manualVerifiedBy");
  });

  test("magistratura present + qo'lda tasdiq → 201, tasdiqlovchi serverda", async () => {
    const r = res();
    const body = { status: "present", manualVerified: true, samsVerified: true };
    await Controller.addAttendance(postReq(body), r, jest.fn());

    expect(r.status).toHaveBeenCalledWith(201);
    expect(Attendance.__built[0]).toMatchObject({ manualVerified: true, manualVerifiedBy: "staff-1" });
    expect(Attendance.__built[0].manualVerifiedAt).toBeInstanceOf(Date);
    expect(Attendance.__built[0]).not.toHaveProperty("samsVerified");
  });

  test("magistratura present + faqat SAMS da'vosi → 400 present_requires_verification", async () => {
    const next = jest.fn();
    await Controller.addAttendance(postReq({ status: "present", samsVerified: true }), res(), next);
    expect(rejected(next)).toMatchObject({ meta: { reason: "present_requires_verification" } });
    expect(rejected(next).message).toBe("Kelganini tasdiqlash uchun SAMS ilovasi yoki qo'lda tasdiq kerak");
  });

  test("takroriy dars tekshiruvi AVVAL ishlaydi (tartib o'zgarmagan)", async () => {
    asProgram("ordinatura");
    Attendance.findOne.mockResolvedValue({ _id: ROW_ID });
    const next = jest.fn();
    const r = res();
    await Controller.addAttendance(postReq({ status: "present" }), r, next);
    expect(rejected(next)).toMatchObject({ statusCode: 400, meta: { reason: "duplicate_lesson" } });
    expect(r.status).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe("updateAttendance — ordinatura: dalil SAQLANGAN yozuvdan", () => {
  beforeEach(() => asProgram("ordinatura"));

  test("🔴 absent → present, so'rovdagi bayroqlar bilan → 400, yozilmaydi", async () => {
    asRow({ status: "absent", samsVerified: false, manualVerified: false });
    const next = jest.fn();
    const body = { status: "present", samsVerified: true, manualVerified: true };
    await Controller.updateAttendance(putReq(body), res(), next);

    expect(rejected(next)).toMatchObject({ statusCode: 400, meta: { reason: "present_requires_sams" } });
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("eski qo'lda tasdiqli present — ball tahrirlanadi, bayroqqa tegilmaydi", async () => {
    asRow({ status: "present", samsVerified: false, manualVerified: true });
    const r = res();
    await Controller.updateAttendance(putReq({ score: 8 }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(updateArg()).toMatchObject({ score: 8 });
    expect(updateArg()).not.toHaveProperty("manualVerified");
  });

  test("eski `samsVerified` (P11 dan oldin) ham dalil — ball o'tadi", async () => {
    asRow({ status: "present", samsVerified: true, manualVerified: false });
    const r = res();
    await Controller.updateAttendance(putReq({ score: 7 }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
  });

  test("qo'lda tasdiqni `false` qilish e'tiborsiz — dalil yo'qolmaydi", async () => {
    asRow({ status: "present", samsVerified: false, manualVerified: true });
    const r = res();
    await Controller.updateAttendance(putReq({ manualVerified: false }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(updateArg()).not.toHaveProperty("manualVerified");
  });
});

describe("updateAttendance — magistratura: qo'lda tasdiq avvalgidek", () => {
  test("false → true: kim/qachon SERVERDA", async () => {
    asRow({ status: "absent", samsVerified: false, manualVerified: false });
    await Controller.updateAttendance(putReq({ status: "present", manualVerified: true }), res(), jest.fn());
    expect(updateArg()).toMatchObject({ manualVerified: true, manualVerifiedBy: "staff-1" });
    expect(updateArg().manualVerifiedAt).toBeInstanceOf(Date);
  });

  test("allaqachon tasdiqlangan — asl tasdiqlovchi qayta yozilmaydi", async () => {
    asRow({ status: "present", samsVerified: false, manualVerified: true });
    await Controller.updateAttendance(putReq({ manualVerified: true, score: 6 }), res(), jest.fn());
    expect(updateArg()).not.toHaveProperty("manualVerifiedBy");
  });

  test("tasdiqni olib, present qoldirish → 400 present_requires_verification", async () => {
    asRow({ status: "present", samsVerified: false, manualVerified: true });
    const next = jest.fn();
    await Controller.updateAttendance(putReq({ manualVerified: false }), res(), next);
    expect(rejected(next)).toMatchObject({ meta: { reason: "present_requires_verification" } });
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("updateAttendance — yozuv CAS bilan (o'qish eskirishi mumkin)", () => {
  const LEGACY = { status: "present", samsVerified: true, manualVerified: false };

  test("🔴 filtrda yozuv PAYTIDAGI dalil sharti bor", async () => {
    asRow(LEGACY);
    await Controller.updateAttendance(putReq({ manualVerified: false }), res(), jest.fn());
    expect(filterArg()).toEqual({
      _id: ROW_ID,
      $or: [{ status: { $ne: "present" } }, { samsVerified: true }],
    });
  });

  test("present ga olib o'tmaydigan tahrir — shartsiz (faqat _id)", async () => {
    asRow({ status: "present", samsVerified: false, manualVerified: true });
    await Controller.updateAttendance(putReq({ status: "absent" }), res(), jest.fn());
    expect(filterArg()).toEqual({ _id: ROW_ID });
  });

  test("🔴 shart yiqildi, qator bor → 409 state_changed, tekshiruv chaqirilmaydi", async () => {
    asRow(LEGACY);
    Attendance.findOneAndUpdate.mockResolvedValue(null);
    Attendance.exists.mockResolvedValue({ _id: ROW_ID });
    const next = jest.fn();
    const r = res();
    await Controller.updateAttendance(putReq({ manualVerified: false }), r, next);

    expect(rejected(next)).toMatchObject({ statusCode: 409, meta: { reason: "state_changed" } });
    expect(r.status).not.toHaveBeenCalled();
    expect(Attendance.exists).toHaveBeenCalledWith({ _id: ROW_ID });
    const { runExpulsionCheck } = require("#modules/4.05-residency/_services/expulsionCheck");
    expect(runExpulsionCheck).not.toHaveBeenCalled();
  });

  test("shart yiqildi, qator yo'q → 404 (avvalgidek)", async () => {
    asRow(LEGACY);
    Attendance.findOneAndUpdate.mockResolvedValue(null);
    Attendance.exists.mockResolvedValue(null);
    const r = res();
    await Controller.updateAttendance(putReq({ manualVerified: false }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(404);
  });

  test("shartsiz yozuvda qator yo'q → 404, `exists` chaqirilmaydi", async () => {
    asRow({ status: "present", samsVerified: false, manualVerified: true });
    Attendance.findOneAndUpdate.mockResolvedValue(null);
    const r = res();
    await Controller.updateAttendance(putReq({ status: "absent" }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(404);
    expect(Attendance.exists).not.toHaveBeenCalled();
  });
});
