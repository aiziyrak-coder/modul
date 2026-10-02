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
const { parseJarayon } = require("#shared/pythonParser");
const {
  subAddFormXlsx,
} = require("#modules/4.02-studyLoad/studyPlan/studyPlan.controller");
const {
  countDerivedWorkingPlans,
} = require("#modules/4.02-studyLoad/studyPlan/studyPlan.derivationGuard");
const Controller = require("./learningProcess.controller");

const LP_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildLpUpdateChain = () => {
  const doc = {
    _id: LP_ID,
    toObject: () => ({ _id: LP_ID, title: "Test yo'nalish OʻQUV REJA" }),
  };
  doc.populate = jest.fn().mockReturnValue(doc);
  return doc;
};

const buildExecChain = (result) => ({
  exec: jest.fn().mockResolvedValue(result),
});

const baseReq = (body) => ({
  params: { id: LP_ID },
  body: { direction: "dir1", ...body },
  scope: {},
  user: { _id: "userId1" },
});

beforeEach(() => {
  jest.clearAllMocks();

  jest
    .spyOn(LearningProcess, "findOne")
    .mockReturnValue(buildExecChain({ _id: LP_ID, status: "new" }));
  jest
    .spyOn(DirectionModel, "findById")
    .mockReturnValue(buildExecChain({ _id: "dir1", title: "Davolash ishi" }));
  jest
    .spyOn(LearningProcess, "findByIdAndUpdate")
    .mockReturnValue(buildLpUpdateChain());
  parseJarayon.mockResolvedValue({
    courses: [{ course: "1-kurs", courseNum: 1 }],
    keys: [],
    allValues: {},
  });
  countDerivedWorkingPlans.mockResolvedValue(0);
});

afterEach(() => jest.restoreAllMocks());

describe("learningProcess.controller — fullUpdate (StudyPlan almashtirish)", () => {
  test("faqat JARAYON fayli almashtirilsa (planFile YO'Q) — studyPlan UMUMAN o'chirilmaydi", async () => {
    jest.spyOn(StudyPlanModel, "deleteMany");
    jest
      .spyOn(StudyPlanModel, "findOne")
      .mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ file: "https://files/old-plan.xlsx" }),
      });
    const res = createRes();
    const next = jest.fn();

    await Controller.fullUpdate(
      baseReq({ file: "https://files/new-process.xlsx", planFile: undefined }),
      res,
      next,
    );

    expect(StudyPlanModel.deleteMany).not.toHaveBeenCalled();
    expect(subAddFormXlsx).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ planFile: "https://files/old-plan.xlsx" }),
    );
  });

  test("planFile bilan almashtirish — AVVAL yaratiladi, KEYIN eski o'chadi (shu tartibda), javob yuboriladi", async () => {
    jest
      .spyOn(StudyPlanModel, "find")
      .mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: "old-sp-1" }]),
      });
    jest.spyOn(StudyPlanModel, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    subAddFormXlsx.mockResolvedValue({
      _id: "new-sp-1",
      file: "https://files/new-plan.xlsx",
    });
    const res = createRes();
    const next = jest.fn();

    await Controller.fullUpdate(
      baseReq({
        file: "https://files/new-process.xlsx",
        planFile: "https://files/new-plan.xlsx",
      }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(subAddFormXlsx).toHaveBeenCalledWith(
      expect.objectContaining({
        learningProcess: LP_ID,
        file: "https://files/new-plan.xlsx",
      }),
    );
    expect(StudyPlanModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ["old-sp-1"] },
    });
    expect(subAddFormXlsx.mock.invocationCallOrder[0]).toBeLessThan(
      StudyPlanModel.deleteMany.mock.invocationCallOrder[0],
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ planFile: "https://files/new-plan.xlsx" }),
    );
  });

  test("yangi planFile parse/yaratish muvaffaqiyatsiz — StudyPlan.deleteMany CHAQIRILMAYDI", async () => {
    jest
      .spyOn(StudyPlanModel, "find")
      .mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: "old-sp-1" }]),
      });
    jest.spyOn(StudyPlanModel, "deleteMany");
    subAddFormXlsx.mockRejectedValue(new Error("planFile yuklanmadi"));
    const res = createRes();
    const next = jest.fn();

    await Controller.fullUpdate(
      baseReq({
        file: "https://files/new-process.xlsx",
        planFile: "https://files/broken-plan.xlsx",
      }),
      res,
      next,
    );

    expect(StudyPlanModel.deleteMany).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: "planFile yuklanmadi" }),
    );
  });

  test("eski rejadan haqiqiy hosila (workingPlan) bor — almashtirish 409 bilan RAD ETILADI, hech narsa o'chmaydi/yaratilmaydi", async () => {
    jest
      .spyOn(StudyPlanModel, "find")
      .mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: "old-sp-derived" }]),
      });
    jest.spyOn(StudyPlanModel, "deleteMany");
    countDerivedWorkingPlans.mockResolvedValue(6);
    const res = createRes();
    const next = jest.fn();

    await Controller.fullUpdate(
      baseReq({
        file: "https://files/new-process.xlsx",
        planFile: "https://files/new-plan.xlsx",
      }),
      res,
      next,
    );

    expect(countDerivedWorkingPlans).toHaveBeenCalledWith(["old-sp-derived"]);
    expect(subAddFormXlsx).not.toHaveBeenCalled();
    expect(StudyPlanModel.deleteMany).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, message: expect.stringContaining("6") }),
    );
  });
});
