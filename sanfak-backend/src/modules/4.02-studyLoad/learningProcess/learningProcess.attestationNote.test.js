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
const { updateLearningProcessSchema } = require("./learningProcess.validation");

const EXCEL_NOTE = "Ixtisoslik fanlaridan birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi";
const HACK = "mijoz yozgan soxta matn";

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
    parsedWith([{ key: "T", note: null }, { key: "A", note: ` ${EXCEL_NOTE} ` }]),
  );
});

afterEach(() => jest.restoreAllMocks());

describe("attestationNote (ADR-038) — addFromXlsx", () => {
  const req = (body) => ({
    body: { file: "https://files/jarayon.xlsx", direction: "dir1", ...body },
    user: { _id: "u1" },
  });

  test("summary'dagi birinchi bo'sh bo'lmagan note yoziladi", async () => {
    await Controller.addFromXlsx(req({}), createRes(), jest.fn());
    expect(LearningProcess.create).toHaveBeenCalledWith(
      expect.objectContaining({ attestationNote: EXCEL_NOTE }),
    );
  });

  test("body'dagi attestationNote e'tiborsiz — Excel matni yoziladi", async () => {
    await Controller.addFromXlsx(req({ attestationNote: HACK }), createRes(), jest.fn());
    const [createObj] = LearningProcess.create.mock.calls[0];
    expect(createObj.attestationNote).toBe(EXCEL_NOTE);
  });

  test("summary yo'q (eski parser/fayl) + body'da matn — baribir null", async () => {
    parseJarayon.mockResolvedValue(parsedWith(undefined));
    await Controller.addFromXlsx(req({ attestationNote: HACK }), createRes(), jest.fn());
    const [createObj] = LearningProcess.create.mock.calls[0];
    expect(createObj.attestationNote).toBeNull();
  });
});

describe("attestationNote (ADR-038) — fullUpdate", () => {
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

  test("fayl-siz shox: body attestationNote yozuv obyektida UMUMAN yo'q", async () => {
    const next = jest.fn();
    await Controller.fullUpdate(req({ attestationNote: HACK }), createRes(), next);
    expect(next).not.toHaveBeenCalled();
    const [, updateObj] = LearningProcess.findByIdAndUpdate.mock.calls[0];
    expect(updateObj).not.toHaveProperty("attestationNote");
  });

  test("faylli shox: Excel'dan qayta hosil qilinadi, body e'tiborsiz", async () => {
    const next = jest.fn();
    await Controller.fullUpdate(
      req({ file: "/files/jarayon.xlsx", attestationNote: HACK }),
      createRes(),
      next,
    );
    expect(next).not.toHaveBeenCalled();
    const [, updateObj] = LearningProcess.findByIdAndUpdate.mock.calls[0];
    expect(updateObj).toHaveProperty("file", "/files/jarayon.xlsx");
    expect(updateObj).toHaveProperty("attestationNote", EXCEL_NOTE);
  });
});

describe("attestationNote (ADR-038) — Joi", () => {
  test("Joi update sxemasida attestationNote kaliti YO'Q (allowlistga qo'shilmagan)", () => {
    expect(updateLearningProcessSchema.describe().keys).not.toHaveProperty("attestationNote");
  });
});
