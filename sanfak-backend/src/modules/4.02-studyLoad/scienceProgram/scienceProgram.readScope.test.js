jest.mock("#modules/4.02-studyLoad/_pdf/scienceProgram.pdf", () => ({
  generateScienceProgramPdf: jest.fn((req, res) =>
    res.status(200).json({ pdf: true }),
  ),
}));

const ScienceProgram = require("./scienceProgram.model");
const Controller = require("./scienceProgram.controller");
const {
  generateScienceProgramPdf,
} = require("#modules/4.02-studyLoad/_pdf/scienceProgram.pdf");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const chainQuery = (resolvedDoc) => {
  const q = {};
  q.populate = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return q;
};

describe("scienceProgram.controller — findOneScienceProgram (NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("scope doirasidagi _id → topiladi (200), filtrda req.scope kalitlari bor", async () => {
    const doc = { _id: "sp1" };
    const spy = jest
      .spyOn(ScienceProgram, "findOne")
      .mockReturnValue(chainQuery(doc));
    const res = createRes();
    const req = {
      params: { id: "sp1" },
      query: {},
      scope: { user: { $in: ["u1"] } },
    };

    await Controller.findOneScienceProgram(req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "sp1", user: { $in: ["u1"] } }),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("doira tashqarisidagi _id → 404", async () => {
    jest.spyOn(ScienceProgram, "findOne").mockReturnValue(chainQuery(null));
    const res = createRes();
    const req = { params: { id: "foreign" }, query: {}, scope: { user: "u1" } };

    await Controller.findOneScienceProgram(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("scienceProgram.controller — sub-topic o'qish endpoint'lari (NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test.each([
    ["findOneScienceProgramTopic", { "theoretical.topics": 1 }],
    ["findOneScienceProgramIndependentTask", { independentTask: 1 }],
    ["findOneScienceProgramSeminarRecommendation", { seminarRecommendation: 1 }],
  ])("%s — filtrda req.scope bor, topilmasa 404", async (method, projection) => {
    const spy = jest.spyOn(ScienceProgram, "findOne").mockResolvedValue(null);
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { user: { $in: ["u1"] } } };

    await Controller[method](req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "foreign", user: { $in: ["u1"] } }),
      projection,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("scienceProgram.controller — generatePdf (NB-1 scope fix, exists-guard)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("doira tashqarisida — exists false → 404, generator CHAQIRILMAYDI", async () => {
    jest.spyOn(ScienceProgram, "exists").mockResolvedValue(null);
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { user: "u1" } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(generateScienceProgramPdf).not.toHaveBeenCalled();
  });

  test("doira ichida — exists true → generator chaqiriladi", async () => {
    jest.spyOn(ScienceProgram, "exists").mockResolvedValue(true);
    const res = createRes();
    const req = { params: { id: "sp1" }, scope: { user: "u1" } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(generateScienceProgramPdf).toHaveBeenCalledWith(
      req,
      res,
      expect.any(Function),
    );
  });
});
