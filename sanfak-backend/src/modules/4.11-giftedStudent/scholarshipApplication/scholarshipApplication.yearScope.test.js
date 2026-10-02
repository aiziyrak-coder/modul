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

jest.mock("./scholarshipApplication.model", () => {
  function Model(data) {
    Object.assign(this, data);
    this.save = jest.fn(async () => {
      Model.__saved.push(this);
      return this;
    });
  }
  Model.findOne = jest.fn();
  Model.__saved = [];
  return Model;
});
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/scholarship/scholarship.model", () => ({
  findById: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/_services/giftedNotify", () => ({
  notifyStudent: jest.fn(),
  notifyUser: jest.fn(),
  EVENTS: {},
  LINKS: {},
}));

const Controller = require("./scholarshipApplication.controller");
const ScholarshipApplication = require("./scholarshipApplication.model");
const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const ScholarshipModel = require("#modules/4.11-giftedStudent/scholarship/scholarship.model");

const SCH_ID = "64b2f0c2a1b2c3d4e5f60718";
const THIS_YEAR = "2026/2027";

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const req = (over = {}) => ({
  user: { _id: "u1" },
  body: {
    scholarship: SCH_ID,
    type: "nomdor_stipendiya",
    scholarshipName: "Beruniy",
    academicYear: THIS_YEAR,
    ...over,
  },
});

const dupFilterOf = () => ScholarshipApplication.findOne.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  ScholarshipApplication.__saved.length = 0;
  GiftedStudent.findOne.mockResolvedValue({ _id: "gs1", totalScore: 100, course: 1 });
  ScholarshipModel.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue(null),
  });
  ScholarshipApplication.findOne
    .mockReturnValueOnce(Promise.resolve(null))
    .mockReturnValueOnce({ sort: jest.fn(() => Promise.resolve(null)) });
});

describe("faol ariza qo'riqchisi — o'quv yili", () => {
  test("🔴 `academicYear` filtrga QO'SHILADI", async () => {
    await Controller.applyForScholarship(req(), mockRes(), jest.fn());
    expect(dupFilterOf()).toMatchObject({
      giftedStudent: "gs1",
      scholarship: SCH_ID,
      academicYear: THIS_YEAR,
    });
  });

  test("stipendiyasiz (TUR bo'yicha) arizada ham yil bor", async () => {
    await Controller.applyForScholarship(
      req({ scholarship: undefined }),
      mockRes(),
      jest.fn(),
    );
    const f = dupFilterOf();
    expect(f.type).toBe("nomdor_stipendiya");
    expect(f.academicYear).toBe(THIS_YEAR);
    expect(f).not.toHaveProperty("scholarship");
  });

  test("holat sharti O'ZGARMAGAN — pending va approved bloklaydi", async () => {
    await Controller.applyForScholarship(req(), mockRes(), jest.fn());
    expect(dupFilterOf().status).toEqual({ $in: ["pending", "approved"] });
  });

  test("yil KELMASA filtr yilsiz qoladi — eski mijoz uchun xulq o'zgarmaydi", async () => {
    await Controller.applyForScholarship(
      req({ academicYear: undefined }),
      mockRes(),
      jest.fn(),
    );
    expect(dupFilterOf()).not.toHaveProperty("academicYear");
  });

  test("mavjud faol ariza HAMON bloklaydi (400)", async () => {
    ScholarshipApplication.findOne.mockReset();
    ScholarshipApplication.findOne.mockReturnValueOnce(
      Promise.resolve({ _id: "x", status: "pending" }),
    );
    const res = mockRes();
    await Controller.applyForScholarship(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ScholarshipApplication.__saved).toHaveLength(0);
  });
});
