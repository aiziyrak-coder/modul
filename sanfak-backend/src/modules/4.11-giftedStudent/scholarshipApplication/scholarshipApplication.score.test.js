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
    this.save = jest.fn(async () => this);
  }
  Model.findById = jest.fn();
  Model.findOne = jest.fn();
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
jest.mock("../_services/scoringLimits", () => ({
  validateScores: jest.fn(async () => null),
  validateAchievementScore: jest.fn(async () => null),
}));

const Controller = require("./scholarshipApplication.controller");
const ScholarshipApplication = require("./scholarshipApplication.model");
const ScholarshipModel = require("#modules/4.11-giftedStudent/scholarship/scholarship.model");

const APP_ID = "64b2f0c2a1b2c3d4e5f60718";
const JUDGE = "64b2f0c2a1b2c3d4e5f60719";
const OTHER_JUDGE = "64b2f0c2a1b2c3d4e5f6071a";
const CRIT = "64b2f0c2a1b2c3d4e5f6071b";

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const req = (scores) => ({
  user: { _id: JUDGE },
  params: { id: APP_ID },
  body: { scores },
});

function mockScholarship() {
  ScholarshipModel.findById.mockReturnValue({
    select: jest.fn(async () => ({ judges: [JUDGE, OTHER_JUDGE], criteria: [] })),
  });
}

function mockApp(judgeScores = []) {
  const app = {
    _id: APP_ID,
    scholarship: "sch-1",
    judgeScores,
    judgeScoreHistory: [],
    save: jest.fn(async () => app),
  };
  ScholarshipApplication.findById.mockResolvedValue(app);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockScholarship();
});

const NEW_SCORES = [{ criteria: CRIT, categoryId: "c1", value: 8 }];

const OLD_AT = new Date("2026-09-01T10:00:00Z");
const oldEntry = () => ({
  judge: JUDGE,
  scores: [{ criteria: CRIT, categoryId: "c1", value: 40 }],
  totalScore: 40,
  submittedAt: OLD_AT,
});

describe("scoreApplication — BIRINCHI baholash", () => {
  test("yozuv qo'shiladi, tarix BO'SH qoladi", async () => {
    const app = mockApp([]);

    await Controller.scoreApplication(req(NEW_SCORES), mockRes(), jest.fn());

    expect(app.judgeScores).toHaveLength(1);
    expect(app.judgeScores[0].totalScore).toBe(8);
    expect(app.judgeScoreHistory).toHaveLength(0);
  });

  test("javobda `corrected: false`", async () => {
    mockApp([]);
    const res = mockRes();

    await Controller.scoreApplication(req(NEW_SCORES), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ corrected: false }),
    );
  });
});

describe("scoreApplication — TUZATISH (D-70)", () => {
  test("🔴 eski ball TARIXGA ko'chadi, yangisi o'rniga yoziladi", async () => {
    const app = mockApp([oldEntry()]);

    await Controller.scoreApplication(req(NEW_SCORES), mockRes(), jest.fn());

    expect(app.judgeScores).toHaveLength(1);
    expect(app.judgeScores[0].totalScore).toBe(8);

    expect(app.judgeScoreHistory).toHaveLength(1);
    expect(app.judgeScoreHistory[0]).toMatchObject({
      judge: JUDGE,
      totalScore: 40,
      submittedAt: OLD_AT,
      supersededBy: JUDGE,
    });
    expect(app.judgeScoreHistory[0].supersededAt).toBeInstanceOf(Date);
  });

  test("IKKI marta tuzatilsa — IKKALASI ham saqlanadi", async () => {
    const app = mockApp([oldEntry()]);
    await Controller.scoreApplication(req(NEW_SCORES), mockRes(), jest.fn());
    await Controller.scoreApplication(
      req([{ criteria: CRIT, categoryId: "c1", value: 5 }]),
      mockRes(),
      jest.fn(),
    );

    expect(app.judgeScoreHistory.map((h) => h.totalScore)).toEqual([40, 8]);
    expect(app.judgeScores[0].totalScore).toBe(5);
  });

  test("javobda `corrected: true`", async () => {
    mockApp([oldEntry()]);
    const res = mockRes();

    await Controller.scoreApplication(req(NEW_SCORES), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ corrected: true }),
    );
  });

  test("BOSHQA hakamning bali TEGILMAYDI", async () => {
    const foreign = {
      judge: OTHER_JUDGE,
      scores: [{ criteria: CRIT, categoryId: "c1", value: 9 }],
      totalScore: 9,
      submittedAt: OLD_AT,
    };
    const app = mockApp([foreign, oldEntry()]);

    await Controller.scoreApplication(req(NEW_SCORES), mockRes(), jest.fn());

    expect(app.judgeScores[0]).toBe(foreign);
    expect(app.judgeScoreHistory).toHaveLength(1);
    expect(String(app.judgeScoreHistory[0].judge)).toBe(JUDGE);
  });
});

describe("scoreApplication — QULF QO'SHILMAGAN (ega qarori)", () => {
  test("🔴 yakunlangandan keyin ham tuzatish 200 qaytaradi", async () => {
    mockApp([oldEntry()]);
    const res = mockRes();

    await Controller.scoreApplication(req(NEW_SCORES), res, jest.fn());

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("tayinlanmagan hakam baribir 403 oladi", async () => {
    ScholarshipModel.findById.mockReturnValue({
      select: jest.fn(async () => ({ judges: [OTHER_JUDGE], criteria: [] })),
    });
    mockApp([]);
    const res = mockRes();

    await Controller.scoreApplication(req(NEW_SCORES), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
