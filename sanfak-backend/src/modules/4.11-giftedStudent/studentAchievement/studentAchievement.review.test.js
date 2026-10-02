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

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function mockApprovedRows(rows) {
  StudentAchievement.find.mockReturnValue({ exec: jest.fn(async () => rows) });
}

const reqEdit = (body = { title: "yangi sarlavha" }) => ({
  user: { _id: "u1", role: { title: "talaba" } },
  params: { id: ACH },
  body,
});

beforeEach(() => {
  jest.clearAllMocks();
  GiftedStudent.findOne.mockResolvedValue({ _id: GS });
  mockApprovedRows([]);
});

const setOf = (call) => call[1].$set ?? call[1];
const pushOf = (call) => call[1].$push;

const current = (status, extra = {}) => ({
  _id: ACH,
  student: GS,
  status,
  ...extra,
});

describe("updateMyAchievement — tahrirdan keyin qayta ko'rib chiqish", () => {
  test("APPROVED tahrirlansa -> pending, ball va review izlari tozalanadi", async () => {
    StudentAchievement.findById.mockResolvedValue(current("approved", { score: 50 }));

    await Controller.updateMyAchievement(reqEdit(), mockRes(), jest.fn());

    const patch = setOf(StudentAchievement.findByIdAndUpdate.mock.calls[0]);
    expect(patch.status).toBe("pending");
    expect(patch.score).toBe(0);
    expect(patch.reviewedBy).toBeNull();
    expect(patch.reviewedAt).toBeNull();
    expect(patch.reviewNote).toBeNull();
    expect(patch.scoreCriteria).toBeNull();
    expect(patch.scoreCategoryId).toBeNull();
    expect(patch.scoreLabel).toBeNull();
  });

  test("APPROVED tahrirlansa reyting QAYTA HISOBLANADI", async () => {
    StudentAchievement.findById.mockResolvedValue(current("approved", { score: 50 }));
    mockApprovedRows([{ score: 30, academicYear: "2026/2027" }]);

    await Controller.updateMyAchievement(reqEdit(), mockRes(), jest.fn());

    expect(GiftedStudent.findByIdAndUpdate).toHaveBeenCalledWith(GS, {
      totalScore: 30,
      scoresByYear: { "2026/2027": 30 },
    });
  });

  test("REJECTED tahrirlansa — avvalgidek pending ga qaytadi", async () => {
    StudentAchievement.findById.mockResolvedValue(current("rejected", { score: 0 }));

    await Controller.updateMyAchievement(reqEdit(), mockRes(), jest.fn());

    expect(setOf(StudentAchievement.findByIdAndUpdate.mock.calls[0]).status).toBe("pending");
    expect(GiftedStudent.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("PENDING tahrirlansa — holat TEGILMAYDI (ortiqcha yozuv yo'q)", async () => {
    StudentAchievement.findById.mockResolvedValue(current("pending"));

    await Controller.updateMyAchievement(reqEdit(), mockRes(), jest.fn());

    const patch = setOf(StudentAchievement.findByIdAndUpdate.mock.calls[0]);
    expect(patch.status).toBeUndefined();
    expect(patch.score).toBeUndefined();
    expect(GiftedStudent.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("BEGONA faoliyat — 403 va hech narsa yozilmaydi", async () => {
    StudentAchievement.findById.mockResolvedValue({
      _id: ACH,
      student: "6a7efdac5916905f06cebead",
      status: "approved",
    });
    const res = mockRes();

    await Controller.updateMyAchievement(reqEdit(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(StudentAchievement.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe("updateMyAchievement — qaror TARIXI (D-62)", () => {
  test("🔴 REJECTED tahrirlansa — sabab TARIXGA ko'chadi", async () => {
    StudentAchievement.findById.mockResolvedValue(
      current("rejected", {
        reviewNote: "Hujjat sifati past",
        reviewedBy: "staff-1",
        reviewedAt: new Date("2026-09-01T10:00:00Z"),
        score: 0,
      }),
    );

    await Controller.updateMyAchievement(reqEdit(), mockRes(), jest.fn());

    const push = pushOf(StudentAchievement.findByIdAndUpdate.mock.calls[0]);
    expect(push.reviewHistory).toMatchObject({
      status: "rejected",
      note: "Hujjat sifati past",
      reviewedBy: "staff-1",
    });
    expect(push.reviewHistory.supersededAt).toBeInstanceOf(Date);
  });

  test("APPROVED tahrirlansa — BALL ham tarixda qoladi", async () => {
    StudentAchievement.findById.mockResolvedValue(
      current("approved", { score: 50, scoreLabel: "Ilmiy maqola (Scopus)" }),
    );

    await Controller.updateMyAchievement(reqEdit(), mockRes(), jest.fn());

    const push = pushOf(StudentAchievement.findByIdAndUpdate.mock.calls[0]);
    expect(push.reviewHistory).toMatchObject({
      status: "approved",
      score: 50,
      scoreLabel: "Ilmiy maqola (Scopus)",
    });
  });

  test("PENDING tahrirlansa — tarixga HECH NARSA qo'shilmaydi", async () => {
    StudentAchievement.findById.mockResolvedValue(current("pending"));

    await Controller.updateMyAchievement(reqEdit(), mockRes(), jest.fn());

    expect(pushOf(StudentAchievement.findByIdAndUpdate.mock.calls[0])).toBeUndefined();
  });

  test("ball `0` HAQIQIY qiymat — tarixda saqlanadi", async () => {
    StudentAchievement.findById.mockResolvedValue(current("approved", { score: 0 }));

    await Controller.updateMyAchievement(reqEdit(), mockRes(), jest.fn());

    expect(pushOf(StudentAchievement.findByIdAndUpdate.mock.calls[0]).reviewHistory.score).toBe(0);
  });

  test("BO'LIM yo'li (`updateAchievement`) da ham rad sababi saqlanadi", async () => {
    StudentAchievement.findById.mockResolvedValue(
      current("rejected", { reviewNote: "Nusxa aniq emas", reviewedBy: "staff-2" }),
    );

    await Controller.updateAchievement(
      { user: { _id: "u9" }, params: { id: ACH }, body: { title: "tuzatildi" } },
      mockRes(),
      jest.fn(),
    );

    const call = StudentAchievement.findByIdAndUpdate.mock.calls[0];
    expect(setOf(call).status).toBe("pending");
    expect(pushOf(call).reviewHistory).toMatchObject({
      status: "rejected",
      note: "Nusxa aniq emas",
    });
  });
});

describe("reviewAchievement — qayta baholash TARIXI (D-63)", () => {
  const reqReview = (body) => ({
    user: { _id: "staff-2", role: { title: "iqtidorli_bolim" } },
    params: { id: ACH },
    body,
  });

  test("🔴 TASDIQLANGAN yozuv rad etilsa — eski ball TARIXDA qoladi", async () => {
    StudentAchievement.findById.mockResolvedValue(
      current("approved", {
        score: 50,
        scoreLabel: "Ilmiy maqola (Scopus)",
        reviewedBy: "staff-1",
        reviewedAt: new Date("2026-09-01T10:00:00Z"),
      }),
    );
    StudentAchievement.findByIdAndUpdate.mockResolvedValue({ _id: ACH, student: GS });

    await Controller.reviewAchievement(
      reqReview({ status: "rejected", reviewNote: "Ball xato hisoblangan" }),
      mockRes(),
      jest.fn(),
    );

    const call = StudentAchievement.findByIdAndUpdate.mock.calls[0];
    expect(pushOf(call).reviewHistory).toMatchObject({
      status: "approved",
      score: 50,
      scoreLabel: "Ilmiy maqola (Scopus)",
      reviewedBy: "staff-1",
    });
    expect(setOf(call)).toMatchObject({ status: "rejected", reviewedBy: "staff-2" });
  });

  test("RAD etilgan yozuv tasdiqlansa — sabab TARIXDA qoladi", async () => {
    StudentAchievement.findById.mockResolvedValue(
      current("rejected", { reviewNote: "Hujjat yetarli emas", reviewedBy: "staff-1" }),
    );
    StudentAchievement.findByIdAndUpdate.mockResolvedValue({ _id: ACH, student: GS });

    await Controller.reviewAchievement(reqReview({ status: "approved" }), mockRes(), jest.fn());

    expect(pushOf(StudentAchievement.findByIdAndUpdate.mock.calls[0]).reviewHistory).toMatchObject({
      status: "rejected",
      note: "Hujjat yetarli emas",
    });
  });

  test("BIRINCHI ko'rib chiqish (pending) — tarixga hech narsa qo'shilmaydi", async () => {
    StudentAchievement.findById.mockResolvedValue(current("pending"));
    StudentAchievement.findByIdAndUpdate.mockResolvedValue({ _id: ACH, student: GS });

    await Controller.reviewAchievement(reqReview({ status: "approved" }), mockRes(), jest.fn());

    const call = StudentAchievement.findByIdAndUpdate.mock.calls[0];
    expect(pushOf(call)).toBeUndefined();
    expect(setOf(call)).toMatchObject({ status: "approved" });
  });

  test("yozuv topilmasa — 404 va HECH NARSA yozilmaydi", async () => {
    StudentAchievement.findById.mockResolvedValue(null);
    const res = mockRes();

    await Controller.reviewAchievement(reqReview({ status: "approved" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(StudentAchievement.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
