jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: { scholarshipResult: jest.fn(() => "") },
}));
jest.mock("./scholarshipApplication.model", () => ({ findOne: jest.fn() }));
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/scholarship/scholarship.model", () => ({
  findById: jest.fn(),
}));


jest.mock("#modules/4.11-giftedStudent/_services/giftedNotify", () => ({
  notifyStudent: jest.fn(),
  notifyUser: jest.fn(),
  EVENTS: {
    ACHIEVEMENT_REVIEWED: "gifted_achievement_reviewed",
    APPLICATION_REVIEWED: "gifted_application_reviewed",
  },
  LINKS: {
    STUDENT_ACTIVITIES: "/gifted-students/student/activities",
    STUDENT_SCHOLARSHIPS: "/gifted-students/student/scholarships",
  },
}));

const Controller = require("./scholarshipApplication.controller");
const ScholarshipApplication = require("./scholarshipApplication.model");
const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const ScholarshipModel = require("#modules/4.11-giftedStudent/scholarship/scholarship.model");

const { currentAcademicYear } = require("#modules/4.11-giftedStudent/_services/academicYearWindow");

const SCH_ID = "64b2f0c2a1b2c3d4e5f60718";
const YIL = currentAcademicYear();
const GS = { _id: "gs1", totalScore: 100, scoresByYear: { [YIL]: 100 } };

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const req = () => ({
  user: { _id: "u1" },
  body: {
    scholarship: SCH_ID,
    type: "nomdor_stipendiya",
    scholarshipName: "Beruniy",
    academicYear: "2025-2026",
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  GiftedStudent.findOne.mockResolvedValue(GS);
  ScholarshipModel.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ minScore: 10 }),
  });
});

describe("applyForScholarship — dup guard", () => {
  test("faol ariza qidiruvi `pending` VA `approved` ni qamrab oladi", async () => {
    ScholarshipApplication.findOne.mockResolvedValue(null);
    await Controller.applyForScholarship(req(), mockRes(), jest.fn());

    const filter = ScholarshipApplication.findOne.mock.calls[0][0];
    expect(filter.status).toEqual({ $in: expect.arrayContaining(["pending", "approved"]) });
    expect(filter.scholarship).toBe(SCH_ID);
    expect(filter.status.$in).not.toContain("rejected");
  });

  test("TASDIQLANGAN ariza mavjud bo'lsa 400 qaytadi", async () => {
    ScholarshipApplication.findOne.mockResolvedValue({ _id: "a1", status: "approved" });
    const res = mockRes();
    await Controller.applyForScholarship(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/allaqachon tasdiqlangan/i);
  });

  test("KUTILAYOTGAN ariza mavjud bo'lsa 400 qaytadi", async () => {
    ScholarshipApplication.findOne.mockResolvedValue({ _id: "a1", status: "pending" });
    const res = mockRes();
    await Controller.applyForScholarship(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/kutilayotgan/i);
  });

  test("giftedStudent topilmasa 404", async () => {
    GiftedStudent.findOne.mockResolvedValue(null);
    const res = mockRes();
    await Controller.applyForScholarship(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("ball minScore'dan kam bo'lsa 400 (eligibility guard)", async () => {
    GiftedStudent.findOne.mockResolvedValue({
      _id: "gs1",
      totalScore: 5,
      scoresByYear: { [YIL]: 5 },
    });
    ScholarshipModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ minScore: 60 }),
    });
    const res = mockRes();
    await Controller.applyForScholarship(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/Ball yetarli emas: 5\/60/);
  });

  test("🔴 UMRBOD ball darvozadan o'tkazmaydi — bu route orqali ham", async () => {
    GiftedStudent.findOne.mockResolvedValue({
      _id: "gs1",
      totalScore: 999,
      scoresByYear: { "2020/2021": 999 },
    });
    ScholarshipModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ minScore: 60 }),
    });
    const res = mockRes();
    await Controller.applyForScholarship(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain(`0/60 (${YIL}`);
  });
});
