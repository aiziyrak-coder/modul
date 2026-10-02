const { createLearningProcessSchema } = require("./learningProcess.validation");

describe("learningProcess.validation — createLearningProcessSchema (BUG-6)", () => {
  const validate = (payload) => createLearningProcessSchema.validate(payload);

  test("planSource: 'ministry' + basisNote bo'sh — RAD etiladi", () => {
    const { error } = validate({ planSource: "ministry", basisNote: "" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Vazirlik rejasida asos izohi majburiy/);
  });

  test("planSource: 'ministry' + basisNote yo'q — RAD etiladi", () => {
    const { error } = validate({ planSource: "ministry" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Vazirlik rejasida asos izohi majburiy/);
  });

  test("planSource: 'ministry' + faqat probel — RAD etiladi (trim)", () => {
    const { error } = validate({ planSource: "ministry", basisNote: "   " });
    expect(error).toBeDefined();
  });

  test("planSource: 'ministry' + basisNote to'ldirilgan — qabul qilinadi", () => {
    const { error } = validate({
      planSource: "ministry",
      basisNote: "Vazirlik 259-sonli buyrug'i asosida",
    });
    expect(error).toBeUndefined();
  });

  test("planSource: 'institute' — basisNote ixtiyoriy (bo'sh bo'lsa ham OK)", () => {
    expect(validate({ planSource: "institute" }).error).toBeUndefined();
    expect(
      validate({ planSource: "institute", basisNote: "" }).error,
    ).toBeUndefined();
  });

  test("planSource yuborilmasa — basisNote ixtiyoriy (jim default 'institute' controller darajasida)", () => {
    expect(validate({}).error).toBeUndefined();
  });

  test("planSource: 'hack' (yaroqsiz qiymat) — RAD etilmaydi (allowlist controllerda, Joi enum'ni bu yerda cheklamaydi)", () => {
    expect(validate({ planSource: "hack" }).error).toBeUndefined();
  });

  describe("POST /learning-process, /upload-pdf — validator middleware", () => {
    const validator = require("#shared/validator");
    const middleware = validator.body(createLearningProcessSchema);

    const run = async (body) => {
      const next = jest.fn();
      await middleware({ body, query: {}, params: {}, headers: {} }, {}, next);
      return next.mock.calls[0]?.[0];
    };

    test("ministry + basisNote yo'q — 400", async () => {
      const err = await run({ planSource: "ministry" });
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(400);
    });

    test("ministry + basisNote bor — o'tadi", async () => {
      expect(
        await run({ planSource: "ministry", basisNote: "asos izohi" }),
      ).toBeUndefined();
    });

    test("institute (yoki planSource yo'q) — o'tadi", async () => {
      expect(await run({ direction: "dir1" })).toBeUndefined();
    });
  });
});

jest.mock("#shared/pythonParser", () => ({
  parseJarayon: jest.fn(),
  fileUrlToPath: jest.fn((x) => x),
  parsePdfReja: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/_services/planStatistics", () => ({
  academicStatistics: jest.fn(() => ({})),
}));
jest.mock("#references/_services/courseResolver", () => ({
  resolveCourse: jest.fn().mockResolvedValue(null),
}));
jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.controller", () => ({
  subAddFormXlsx: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.derivationGuard");

const LearningProcess = require("./learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const Controller = require("./learningProcess.controller");

const LP_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildLpUpdateChain = () => {
  const doc = { _id: LP_ID, toObject: () => ({ _id: LP_ID }) };
  doc.populate = jest.fn().mockReturnValue(doc);
  return doc;
};

describe("learningProcess.controller.fullUpdate — BUG-6 ministry gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(DirectionModel, "findById")
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: "dir1", title: "Davolash ishi" }) });
    jest
      .spyOn(LearningProcess, "findByIdAndUpdate")
      .mockReturnValue(buildLpUpdateChain());
    jest.spyOn(StudyPlanModel, "findOne").mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ file: null }),
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test("mavjud hujjat planSource='ministry', basisNote bo'sh yuborilsa — 400, yozilmaydi", async () => {
    jest.spyOn(LearningProcess, "findOne").mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ _id: LP_ID, status: "new", planSource: "ministry", basisNote: "eski izoh" }),
    });

    const next = jest.fn();
    await Controller.fullUpdate(
      {
        params: { id: LP_ID },
        body: { direction: "dir1", basisNote: "" },
        scope: {},
        user: { _id: "u1" },
      },
      createRes(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/Vazirlik rejasida asos izohi majburiy/);
    expect(LearningProcess.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("mavjud hujjat planSource='ministry', basisNote UMUMAN yuborilmasa — mavjud qiymat (bo'sh emas) saqlangani uchun o'tadi", async () => {
    jest.spyOn(LearningProcess, "findOne").mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ _id: LP_ID, status: "new", planSource: "ministry", basisNote: "eski izoh" }),
    });

    const next = jest.fn();
    await Controller.fullUpdate(
      {
        params: { id: LP_ID },
        body: { direction: "dir1" },
        scope: {},
        user: { _id: "u1" },
      },
      createRes(),
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(LearningProcess.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("mavjud hujjat planSource='ministry', eski basisNote ham bo'sh, yangisi yuborilmasa — 400", async () => {
    jest.spyOn(LearningProcess, "findOne").mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ _id: LP_ID, status: "new", planSource: "ministry", basisNote: null }),
    });

    const next = jest.fn();
    await Controller.fullUpdate(
      {
        params: { id: LP_ID },
        body: { direction: "dir1" },
        scope: {},
        user: { _id: "u1" },
      },
      createRes(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(LearningProcess.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("mavjud hujjat planSource='ministry', basisNote yangi qiymat bilan yuborilsa — o'tadi", async () => {
    jest.spyOn(LearningProcess, "findOne").mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ _id: LP_ID, status: "new", planSource: "ministry", basisNote: null }),
    });

    const next = jest.fn();
    await Controller.fullUpdate(
      {
        params: { id: LP_ID },
        body: { direction: "dir1", basisNote: "yangi asos izohi" },
        scope: {},
        user: { _id: "u1" },
      },
      createRes(),
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(LearningProcess.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("mavjud hujjat planSource='institute' — basisNote bo'sh bo'lsa ham gate ishlamaydi", async () => {
    jest.spyOn(LearningProcess, "findOne").mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ _id: LP_ID, status: "new", planSource: "institute", basisNote: null }),
    });

    const next = jest.fn();
    await Controller.fullUpdate(
      {
        params: { id: LP_ID },
        body: { direction: "dir1", basisNote: "" },
        scope: {},
        user: { _id: "u1" },
      },
      createRes(),
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(LearningProcess.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });
});
