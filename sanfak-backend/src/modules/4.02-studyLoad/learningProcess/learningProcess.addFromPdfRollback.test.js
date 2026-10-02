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
jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const LearningProcess = require("./learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const ScienceModel = require("#references/science/science.model");
const winston = require("#shared/winston.logger");
const { parsePdfReja } = require("#shared/pythonParser");
const Controller = require("./learningProcess.controller");

const LP_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseReq = (body) => ({
  body: { file: "https://files/reja.pdf", direction: "dir1", ...body },
  user: { _id: "u1" },
});

beforeEach(() => {
  jest.clearAllMocks();

  jest
    .spyOn(DirectionModel, "findById")
    .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: "dir1", title: "Davolash ishi" }) });

  jest.spyOn(LearningProcess, "create").mockResolvedValue({ _id: LP_ID });
  jest.spyOn(LearningProcess, "findOne").mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) });
  jest.spyOn(LearningProcess, "findByIdAndDelete").mockResolvedValue({ _id: LP_ID });

  jest.spyOn(ScienceModel, "findOne").mockReturnValue({
    exec: jest.fn().mockResolvedValue(null),
  });

  parsePdfReja.mockResolvedValue({
    courses: [],
    keys: ["k1"],
    allValues: {},
    comment: "izoh",
    header: {},
    learningProcessKeys: [],
    blocks: [
      {
        sciences: [{ code: "SCI1", title: "Fan 1" }],
      },
    ],
  });
});

afterEach(() => jest.restoreAllMocks());

describe("learningProcess.controller.addFromPdf — BUG-2 kompensatsiya", () => {
  test("StudyPlanModel.create xato bersa — yangi yaratilgan lpDoc o'chiriladi", async () => {
    jest
      .spyOn(StudyPlanModel, "create")
      .mockRejectedValue(new Error("ValidationError: blocks required"));

    const next = jest.fn();
    const res = createRes();

    await Controller.addFromPdf(baseReq(), res, next);

    expect(LearningProcess.findByIdAndDelete).toHaveBeenCalledTimes(1);
    expect(LearningProcess.findByIdAndDelete).toHaveBeenCalledWith(LP_ID);

    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
  });

  test("kompensatsiya o'chirish o'zi xato bersa — winston.error bilan loglanadi, asl xato yutiladi", async () => {
    jest
      .spyOn(StudyPlanModel, "create")
      .mockRejectedValue(new Error("ValidationError: blocks required"));
    jest
      .spyOn(LearningProcess, "findByIdAndDelete")
      .mockRejectedValue(new Error("Mongo down"));

    const next = jest.fn();
    const res = createRes();

    await Controller.addFromPdf(baseReq(), res, next);

    expect(winston.error).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.detail || err.message).toEqual(
      expect.stringContaining("ValidationError: blocks required"),
    );
  });

  test("muvaffaqiyatli holatda hech narsa o'chirilmaydi (regressiyaga qarshi)", async () => {
    jest
      .spyOn(StudyPlanModel, "create")
      .mockResolvedValue({ _id: "sp1", blocks: [] });

    const next = jest.fn();
    const res = createRes();

    await Controller.addFromPdf(baseReq(), res, next);

    expect(LearningProcess.findByIdAndDelete).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
