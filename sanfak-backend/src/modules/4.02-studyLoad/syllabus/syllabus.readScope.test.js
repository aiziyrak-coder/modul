jest.mock("#modules/4.02-studyLoad/_pdf/syllabus.pdf", () => ({
  generateSyllabusPdf: jest.fn((req, res) => res.status(200).json({ pdf: true })),
}));

const Syllabus = require("./syllabus.model");
const Controller = require("./syllabus.controller");
const { generateSyllabusPdf } = require("#modules/4.02-studyLoad/_pdf/syllabus.pdf");

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

describe("syllabus.controller — findOneSyllabus (NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("scope doirasidagi _id → topiladi (200) va filtrda req.scope kalitlari bor", async () => {
    const doc = { _id: "syl1", title: "Sillabus" };
    const spy = jest.spyOn(Syllabus, "findOne").mockReturnValue(chainQuery(doc));
    const res = createRes();
    const req = {
      params: { id: "syl1" },
      scope: { "author.teacher": { $in: ["u1", "u2"] } },
    };

    await Controller.findOneSyllabus(req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "syl1",
        "author.teacher": { $in: ["u1", "u2"] },
      }),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(doc);
  });

  test("doira tashqarisidagi _id → 404 (findOne natijasiz)", async () => {
    jest.spyOn(Syllabus, "findOne").mockReturnValue(chainQuery(null));
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { "author.teacher": "u1" } };

    await Controller.findOneSyllabus(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("syllabus.controller — generatePdf (NB-1 scope fix, exists-guard)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("doira tashqarisida — exists false → 404, generator CHAQIRILMAYDI", async () => {
    jest.spyOn(Syllabus, "exists").mockResolvedValue(null);
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { "author.teacher": "u1" } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(generateSyllabusPdf).not.toHaveBeenCalled();
  });

  test("doira ichida — exists true → generator chaqiriladi", async () => {
    jest.spyOn(Syllabus, "exists").mockResolvedValue(true);
    const res = createRes();
    const req = { params: { id: "syl1" }, scope: { "author.teacher": "u1" } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(generateSyllabusPdf).toHaveBeenCalledWith(req, res, expect.any(Function));
  });
});
