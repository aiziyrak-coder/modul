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
  subAddFormXlsx: jest.fn().mockResolvedValue({}),
}));

const LearningProcess = require("./learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const { parseJarayon } = require("#shared/pythonParser");
const Controller = require("./learningProcess.controller");
const {
  createLearningProcessSchema,
  updateLearningProcessSchema,
} = require("./learningProcess.validation");

const HACK = [{ key: "A", title: "mijoz yozgan soxta nom" }];
const EXPECTED = [
  { key: "M", title: "Amaliyot" },
  { key: "A", title: "Attestatsiyalar" },
];

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const parsedWith = (summary) => ({
  courses: [{ course: "1-kurs", courseNum: 1 }],
  keys: [],
  allValues: {},
  summary,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(DirectionModel, "findById")
    .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: "dir1", title: "Davolash ishi" }) });
  jest.spyOn(LearningProcess, "create").mockResolvedValue({ _id: "lp1" });
  jest.spyOn(LearningProcess, "findOne").mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) });
  parseJarayon.mockResolvedValue(
    parsedWith([
      { key: "M", title: " Amaliyot " },
      { key: null, title: "Legendga mos kelmagan" },
      { key: "A", title: "Attestatsiyalar" },
    ]),
  );
});

afterEach(() => jest.restoreAllMocks());

describe("summaryRows (ADR-040) — addFromXlsx", () => {
  const req = (body) => ({
    body: { file: "https://files/jarayon.xlsx", direction: "dir1", ...body },
    user: { _id: "u1" },
  });

  test("parser summary'dan yoziladi, body'dagi summaryRows e'tiborsiz", async () => {
    await Controller.addFromXlsx(req({ summaryRows: HACK }), createRes(), jest.fn());
    const [createObj] = LearningProcess.create.mock.calls[0];
    expect(createObj.summaryRows).toEqual(EXPECTED);
  });

  test("summary yo'q + body'da qiymat — baribir null", async () => {
    parseJarayon.mockResolvedValue(parsedWith(undefined));
    await Controller.addFromXlsx(req({ summaryRows: HACK }), createRes(), jest.fn());
    const [createObj] = LearningProcess.create.mock.calls[0];
    expect(createObj.summaryRows).toBeNull();
  });
});

describe("summaryRows (ADR-040) — fullUpdate", () => {
  const LP_ID = "cccccccccccccccccccccccc";

  beforeEach(() => {
    const doc = { _id: LP_ID, toObject: () => ({ _id: LP_ID }) };
    doc.populate = jest.fn().mockReturnValue(doc);
    jest
      .spyOn(LearningProcess, "findOne")
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: LP_ID, status: "new" }) });
    jest.spyOn(LearningProcess, "findByIdAndUpdate").mockReturnValue(doc);
    jest.spyOn(StudyPlanModel, "findOne").mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ file: null }),
    });
  });

  const req = (body) => ({
    params: { id: LP_ID },
    body: { direction: "dir1", ...body },
    scope: {},
    user: { _id: "u1" },
  });

  test("fayl-siz shox: body summaryRows yozuv obyektida UMUMAN yo'q", async () => {
    const next = jest.fn();
    await Controller.fullUpdate(req({ summaryRows: HACK }), createRes(), next);
    expect(next).not.toHaveBeenCalled();
    const [, updateObj] = LearningProcess.findByIdAndUpdate.mock.calls[0];
    expect(updateObj).not.toHaveProperty("summaryRows");
  });

  test("faylli shox: Excel'dan qayta hosil qilinadi, body e'tiborsiz", async () => {
    const next = jest.fn();
    await Controller.fullUpdate(
      req({ file: "/files/jarayon.xlsx", summaryRows: HACK }),
      createRes(),
      next,
    );
    expect(next).not.toHaveBeenCalled();
    const [, updateObj] = LearningProcess.findByIdAndUpdate.mock.calls[0];
    expect(updateObj).toHaveProperty("summaryRows", EXPECTED);
  });
});

describe("summaryRows (ADR-040) — Joi", () => {
  test("create/update sxemalarida summaryRows kaliti YO'Q", () => {
    expect(createLearningProcessSchema.describe().keys).not.toHaveProperty("summaryRows");
    expect(updateLearningProcessSchema.describe().keys).not.toHaveProperty("summaryRows");
  });
});
