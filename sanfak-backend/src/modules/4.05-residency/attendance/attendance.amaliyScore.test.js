"use strict";

const mockSave = jest.fn();
jest.mock("./attendance.model", () => {
  function Attendance(payload) {
    Object.assign(this, payload);
    this.save = (...a) => mockSave(...a);
  }
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

const { ErrorHandler } = require("#shared/error");
const Attendance = require("./attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { runExpulsionCheck } = require("#modules/4.05-residency/_services/expulsionCheck");
const Controller = require("./attendance.controller");

const RES_ID = "6a97de5a52685c2068a0a543";
const ROW_ID = "6a5a0acbd34b3c21a575d59d";
const SESSION_TEXT =
  "Amaliy mashg'ulotga har dars uchun ball qo'yilmaydi — oraliq nazorat orqali baholanadi";

const res = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const staff = { _id: "staff-1", role: { title: "magistratura_bolim", scopeLevel: "global" } };
const stranger = { _id: "ustoz-2", role: { title: "klinik_ustoz", scopeLevel: "self" } };
const postReq = (body) => ({ user: staff, body: { resident: RES_ID, date: "2026-09-02", ...body } });
const putReq = (body, user = staff) => ({ user, params: { id: ROW_ID }, body });
const asProgram = (program) =>
  Resident.findById.mockResolvedValue({ _id: RES_ID, program, group: null, supervisor: "ustoz-1" });
const asRow = (row) => Attendance.findById.mockResolvedValue({ resident: RES_ID, ...row });
const rejected = (next) => next.mock.calls[0]?.[0];

const expectNotGraded = (next) => {
  const err = rejected(next);
  expect(err).toBeInstanceOf(ErrorHandler);
  expect(err).toMatchObject({ statusCode: 409, message: SESSION_TEXT, meta: { reason: "lesson_type_not_graded" } });
};

beforeEach(() => {
  jest.clearAllMocks();
  Attendance.findOne.mockResolvedValue(null);
  Attendance.findOneAndUpdate.mockResolvedValue({ resident: RES_ID });
  asProgram("magistratura");
  mockSave.mockResolvedValue({});
});

describe("addAttendance — amaliy qatorga dars bahosi yo'q", () => {
  test("🔴 magistratura present + qo'lda tasdiq + amaliy + 8 → 409, yozilmaydi", async () => {
    const next = jest.fn();
    const r = res();
    const body = { status: "present", manualVerified: true, lessonType: "amaliy", score: 8 };
    await Controller.addAttendance(postReq(body), r, next);

    expectNotGraded(next);
    expect(r.status).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(runExpulsionCheck).not.toHaveBeenCalled();
  });

  test("🔴 ordinatura absent + amaliy + 5 → 409 (400 notPresent EMAS — tartib)", async () => {
    asProgram("ordinatura");
    const next = jest.fn();
    const r = res();
    await Controller.addAttendance(postReq({ status: "absent", lessonType: "amaliy", score: 5 }), r, next);

    expectNotGraded(next);
    expect(r.status).not.toHaveBeenCalledWith(400);
    expect(mockSave).not.toHaveBeenCalled();
    expect(runExpulsionCheck).not.toHaveBeenCalled();
  });

  test("amaliy, ballsiz → 201", async () => {
    const r = res();
    await Controller.addAttendance(postReq({ status: "absent", lessonType: "amaliy" }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(201);
    expect(mockSave).toHaveBeenCalled();
  });

  test("maruza + ball (magistratura) → 201, avvalgidek", async () => {
    const r = res();
    const body = { status: "present", manualVerified: true, lessonType: "maruza", score: 8 };
    await Controller.addAttendance(postReq(body), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(201);
    expect(mockSave).toHaveBeenCalled();
  });
});

describe("updateAttendance — amaliy qatorga dars bahosi yo'q", () => {
  const AMALIY_MANUAL = { status: "present", manualVerified: true, lessonType: "amaliy", score: null };

  test("🔴 {score:8} amaliy qo'lda qatorda → 409, findOneAndUpdate chaqirilmaydi", async () => {
    asRow(AMALIY_MANUAL);
    const next = jest.fn();
    await Controller.updateAttendance(putReq({ score: 8 }), res(), next);
    expectNotGraded(next);
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
    expect(runExpulsionCheck).not.toHaveBeenCalled();
  });

  test("{score:null} ballli amaliy qatorda → 200 (tozalash)", async () => {
    asRow({ ...AMALIY_MANUAL, score: 7 });
    const r = res();
    await Controller.updateAttendance(putReq({ score: null }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(Attendance.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ score: null });
  });

  test("🔴 {lessonType:amaliy} ballli maruza qatorda → 409", async () => {
    asRow({ ...AMALIY_MANUAL, lessonType: "maruza", score: 8 });
    const next = jest.fn();
    await Controller.updateAttendance(putReq({ lessonType: "amaliy" }), res(), next);
    expectNotGraded(next);
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("{hours:3} ballli tarixiy amaliy qatorda → 200, ball tegilmaydi (L3-Q14)", async () => {
    asRow({ ...AMALIY_MANUAL, score: 7 });
    const r = res();
    await Controller.updateAttendance(putReq({ hours: 3 }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(Attendance.findOneAndUpdate.mock.calls[0][1]).not.toHaveProperty("score");
  });

  test("🔴 ordinatura absent amaliy qator {score:8} → 409 (ball oynasi 400 EMAS — tartib)", async () => {
    asProgram("ordinatura");
    asRow({ status: "absent", lessonType: "amaliy", score: null });
    const next = jest.fn();
    const r = res();
    await Controller.updateAttendance(putReq({ score: 8 }), r, next);
    expectNotGraded(next);
    expect(r.status).not.toHaveBeenCalledWith(400);
  });

  test("doiradan tashqari ustoz → 404 409 dan OLDIN (saqlangan dars turi oshkor emas)", async () => {
    asRow(AMALIY_MANUAL);
    const next = jest.fn();
    const r = res();
    await Controller.updateAttendance(putReq({ score: 8 }, stranger), r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

const rejectedWith = (next, statusCode, reason) =>
  expect(rejected(next)).toMatchObject({ statusCode, meta: { reason } });

describe("tartib — takror dars va «Keldi» dalili 409 dan OLDIN", () => {
  test("ordinatura POST present + amaliy + 8 → 400 present_requires_sams (409 EMAS)", async () => {
    asProgram("ordinatura");
    const next = jest.fn();
    await Controller.addAttendance(postReq({ status: "present", lessonType: "amaliy", score: 8 }), res(), next);
    rejectedWith(next, 400, "present_requires_sams");
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("POST amaliy + 8, dars allaqachon bor → 400 duplicate_lesson (409 EMAS)", async () => {
    Attendance.findOne.mockResolvedValueOnce({ _id: ROW_ID });
    const next = jest.fn();
    const body = { status: "present", manualVerified: true, lessonType: "amaliy", score: 8 };
    await Controller.addAttendance(postReq(body), res(), next);
    rejectedWith(next, 400, "duplicate_lesson");
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("ordinatura PUT {score:8} dalilsiz present amaliy qatorda → 400 dalil (409 EMAS)", async () => {
    asProgram("ordinatura");
    asRow({ status: "present", lessonType: "amaliy", score: null });
    const next = jest.fn();
    await Controller.updateAttendance(putReq({ score: 8 }), res(), next);
    rejectedWith(next, 400, "present_requires_sams");
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("tozalash ball oynasidan o'tadi (L3-Q14) va CAS sharti (L3-Q13)", () => {
  const ORD_SCORED = { status: "absent", lessonType: "amaliy", score: 7 };

  test("ordinatura absent ballli amaliy qator {score:null} → 200 (oyna saqlangan ballni o'qimaydi)", async () => {
    asProgram("ordinatura");
    asRow(ORD_SCORED);
    const r = res();
    await Controller.updateAttendance(putReq({ score: null }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(Attendance.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ score: null });
  });

  test("ordinatura present ballli amaliy qator {status:absent, score:null} → 200", async () => {
    asProgram("ordinatura");
    asRow({ ...ORD_SCORED, status: "present", manualVerified: true });
    const r = res();
    await Controller.updateAttendance(putReq({ status: "absent", score: null }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
  });

  test("ordinatura absent ballli amaliy qator {hours:3} → ball oynasi 400, avvalgidek", async () => {
    asProgram("ordinatura");
    asRow(ORD_SCORED);
    const r = res();
    await Controller.updateAttendance(putReq({ hours: 3 }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(400);
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("{score:8} maruza qatorda → CAS dars turini qotiradi", async () => {
    asRow({ status: "present", manualVerified: true, lessonType: "maruza", score: null });
    await Controller.updateAttendance(putReq({ score: 8 }), res(), jest.fn());
    expect(Attendance.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ lessonType: { $nin: ["amaliy"] } });
  });

  test("{lessonType:amaliy} ballsiz maruza qatorda → 200, CAS ballni null deb qotiradi", async () => {
    asRow({ status: "present", manualVerified: true, lessonType: "maruza", score: null });
    const r = res();
    await Controller.updateAttendance(putReq({ lessonType: "amaliy" }), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(Attendance.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ score: null });
  });
});
