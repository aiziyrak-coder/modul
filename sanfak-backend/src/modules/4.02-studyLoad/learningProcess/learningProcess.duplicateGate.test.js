jest.mock("#shared/pythonParser", () => ({
  parseJarayon: jest.fn(),
  parsePdfReja: jest.fn(),
  fileUrlToPath: jest.fn((x) => x),
  stripFileUrlQuery: jest.fn((x) => x),
}));
jest.mock("#modules/4.02-studyLoad/_services/planStatistics", () => ({
  academicStatistics: jest.fn().mockReturnValue({}),
}));
jest.mock("#references/_services/courseResolver", () => ({
  resolveCourse: jest.fn().mockResolvedValue(null),
}));
jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.controller", () => ({
  subAddFormXlsx: jest.fn().mockResolvedValue({ _id: "sp1", file: null }),
}));

const LearningProcess = require("./learningProcess.model");
const DirectionModel = require("#references/direction/direction.model");
const { parseJarayon, parsePdfReja } = require("#shared/pythonParser");
const Controller = require("./learningProcess.controller");

const DIR = "6a9a1111111111111111aaaa";
const EDU = "6a9a2222222222222222bbbb";
const SPEC = "6a9a3333333333333333cccc";
const EXISTING = { _id: "6a9a93839b17830309b6d12d", title: "Davolash ishi OʻQUV REJA", status: "created", year: "2023" };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

let findOneChain;
const stubFindOne = (result) => {
  findOneChain = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(result) };
  return jest.spyOn(LearningProcess, "findOne").mockReturnValue(findOneChain);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(DirectionModel, "findById")
    .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: DIR, title: "Davolash ishi" }) });
  jest.spyOn(LearningProcess, "create").mockResolvedValue({ _id: "lpNew" });
  parseJarayon.mockResolvedValue({ courses: [{ course: "1-kurs", courseNum: 1 }], keys: [], allValues: {} });
  parsePdfReja.mockResolvedValue({ courses: [], keys: [], allValues: {}, comment: null, header: {}, learningProcessKeys: [], blocks: [] });
});
afterEach(() => jest.restoreAllMocks());

const xlsxReq = (body = {}) => ({
  body: { file: "https://files/jarayon.xlsx", direction: DIR, year: "2023", educationForm: EDU, specialization: SPEC, ...body },
  user: { _id: "u1" },
});

describe("learningProcess.controller — P-08 dublikat darvozasi (addFromXlsx)", () => {
  test("mavjud reja bor → 409 + existingId, create CHAQIRILMAYDI", async () => {
    stubFindOne(EXISTING);
    const next = jest.fn();
    await Controller.addFromXlsx(xlsxReq(), createRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/allaqachon mavjud/);
    expect(err.message).toMatch(/2023/);
    expect(err.meta).toEqual({ existingId: EXISTING._id });
    expect(LearningProcess.create).not.toHaveBeenCalled();
  });

  test("filtr: direction + year (string) + archivedAt:null + educationForm + specialization", async () => {
    const spy = stubFindOne(null);
    await Controller.addFromXlsx(xlsxReq({ year: 2023 }), createRes(), jest.fn());

    expect(spy).toHaveBeenCalledWith({
      direction: DIR,
      year: "2023",
      archivedAt: null,
      educationForm: EDU,
      specialization: SPEC,
    });
    expect(findOneChain.select).toHaveBeenCalledWith("_id title status year");
    expect(LearningProcess.create).toHaveBeenCalledTimes(1);
  });

  test("educationForm/specialization berilmasa filtrga kirmaydi (kengroq tekshiruv)", async () => {
    const spy = stubFindOne(null);
    await Controller.addFromXlsx(xlsxReq({ educationForm: undefined, specialization: undefined }), createRes(), jest.fn());
    expect(spy).toHaveBeenCalledWith({ direction: DIR, year: "2023", archivedAt: null });
  });

  test("dublikat yo'q → create avvalgidek", async () => {
    stubFindOne(null);
    const next = jest.fn();
    await Controller.addFromXlsx(xlsxReq(), createRes(), next);
    expect(next).not.toHaveBeenCalled();
    expect(LearningProcess.create).toHaveBeenCalledTimes(1);
  });
});

describe("learningProcess.controller — P-08 dublikat darvozasi (addFromPdf)", () => {
  test("mavjud reja bor → 409, PDF parse ham chaqirilmaydi (arzon darvoza)", async () => {
    stubFindOne(EXISTING);
    const next = jest.fn();
    await Controller.addFromPdf(
      { body: { file: "https://files/reja.pdf", direction: DIR, year: "2023", educationForm: EDU, specialization: SPEC }, user: { _id: "u1" } },
      createRes(),
      next,
    );
    expect(next.mock.calls[0][0].statusCode).toBe(409);
    expect(parsePdfReja).not.toHaveBeenCalled();
    expect(LearningProcess.create).not.toHaveBeenCalled();
  });
});
