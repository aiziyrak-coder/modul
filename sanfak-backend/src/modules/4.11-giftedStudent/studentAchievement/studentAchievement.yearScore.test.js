jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("#system/notification/notification.service", () => ({ notify: jest.fn() }));
jest.mock("#modules/4.11-giftedStudent/_services/giftedNotify", () => ({
  notifyStudent: jest.fn(),
  notifyUser: jest.fn(),
  EVENTS: { ACHIEVEMENT_REVIEWED: "gifted_achievement_reviewed" },
  LINKS: { STUDENT_ACTIVITIES: "/gifted-students/student/activities" },
}));
jest.mock("../_services/studentAccess", () => ({
  denyStudentAccess: jest.fn(),
  resolveOwnedGiftedStudentIds: jest.fn(),
}));
jest.mock("../_services/moduleRoles", () => ({ isAchievementReviewer: jest.fn(() => true) }));
jest.mock("#modules/4.11-giftedStudent/documentType/documentType.model", () => ({
  find: jest.fn(() => ({ distinct: jest.fn(async () => []) })),
}));
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(async () => ({})),
}));
jest.mock("./studentAchievement.model", () => {
  const Model = jest.fn();
  Model.find = jest.fn();
  Model.findById = jest.fn();
  Model.findByIdAndUpdate = jest.fn(async () => ({}));
  return Model;
});

const Controller = require("./studentAchievement.controller");
const StudentAchievement = require("./studentAchievement.model");
const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");

const GS = "6a7efdac5916905f06cebeac";
const ACH = "6a7efdac5916905f06cebeae";

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const mockApprovedRows = (rows) => {
  StudentAchievement.find.mockReturnValue({ exec: jest.fn(async () => rows) });
};

const drive = async (approvedRows) => {
  jest.clearAllMocks();
  GiftedStudent.findOne.mockResolvedValue({ _id: GS });
  StudentAchievement.findById.mockResolvedValue({
    _id: ACH,
    student: GS,
    status: "approved",
    score: 50,
  });
  mockApprovedRows(approvedRows);
  await Controller.updateMyAchievement(
    { user: { _id: "u1", role: { title: "talaba" } }, params: { id: ACH }, body: { title: "x" } },
    mockRes(),
    jest.fn(),
  );
  return GiftedStudent.findByIdAndUpdate.mock.calls[0][1];
};

describe("recalcTotal — yil bo'yicha taqsimot", () => {
  test("🔴 jonli holat: 392.5 = 80 (2025/2026) + 312.5 (2026/2027)", async () => {
    const patch = await drive([
      { score: 50, academicYear: "2025/2026" },
      { score: 30, academicYear: "2025/2026" },
      { score: 312.5, academicYear: "2026/2027" },
    ]);
    expect(patch.totalScore).toBe(392.5);
    expect(patch.scoresByYear).toEqual({ "2025/2026": 80, "2026/2027": 312.5 });
  });

  test("UMRBOD yig'indi O'ZGARMAYDI — eski o'quvchilar buzilmaydi", async () => {
    const patch = await drive([
      { score: 999, academicYear: "2025/2026" },
      { score: 1, academicYear: "2026/2027" },
    ]);
    expect(patch.totalScore).toBe(1000);
  });

  test("yil MUHRI bo'lmasa `createdAt` dan hisoblanadi (ortga to'ldirishsiz ham to'g'ri)", async () => {
    const patch = await drive([
      { score: 80, createdAt: new Date(2026, 7, 14) },
      { score: 312.5, createdAt: new Date(2026, 8, 3) },
    ]);
    expect(patch.scoresByYear).toEqual({ "2025/2026": 80, "2026/2027": 312.5 });
  });

  test("muhr `createdAt` dan USTUN — sentabrda tasdiqlangan avgust yutug'i ko'chmaydi", async () => {
    const patch = await drive([
      { score: 40, academicYear: "2025/2026", createdAt: new Date(2026, 8, 3) },
    ]);
    expect(patch.scoresByYear).toEqual({ "2025/2026": 40 });
  });

  test("sanasi ham, muhri ham yo'q qator: `totalScore` ga KIRADI, xaritaga kirmaydi", async () => {
    const patch = await drive([{ score: 25 }, { score: 75, academicYear: "2026/2027" }]);
    expect(patch.totalScore).toBe(100);
    expect(patch.scoresByYear).toEqual({ "2026/2027": 75 });
  });

  test("tasdiqlangan yutuq qolmasa — ikkalasi ham BO'SHATILADI", async () => {
    const patch = await drive([]);
    expect(patch.totalScore).toBe(0);
    expect(patch.scoresByYear).toEqual({});
  });

  test("ballsiz (null) qator yig'indini buzmaydi", async () => {
    const patch = await drive([
      { score: null, academicYear: "2026/2027" },
      { score: 10, academicYear: "2026/2027" },
    ]);
    expect(patch.totalScore).toBe(10);
    expect(patch.scoresByYear).toEqual({ "2026/2027": 10 });
  });

  test("uchta yil — hammasi alohida kalitda", async () => {
    const patch = await drive([
      { score: 1, academicYear: "2024/2025" },
      { score: 2, academicYear: "2025/2026" },
      { score: 4, academicYear: "2026/2027" },
    ]);
    expect(patch.scoresByYear).toEqual({
      "2024/2025": 1,
      "2025/2026": 2,
      "2026/2027": 4,
    });
    expect(patch.totalScore).toBe(7);
  });

  test("yozuv BITTA chaqiruvda — ikkala maydon birga boradi", async () => {
    await drive([{ score: 5, academicYear: "2026/2027" }]);
    expect(GiftedStudent.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(Object.keys(GiftedStudent.findByIdAndUpdate.mock.calls[0][1]).sort()).toEqual([
      "scoresByYear",
      "totalScore",
    ]);
  });
});
