jest.mock("#modules/4.12-qualityAssurance/_shared/qualityNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(null),
  safeDispatchMany: jest.fn().mockResolvedValue({ total: 0, success: 0, failed: 0 }),
  getSifatBolimiUserIds: jest.fn().mockResolvedValue([]),
}));

const IndicatorSubmission = require("./indicatorSubmission.model");
const Indicator = require("#modules/4.12-qualityAssurance/indicator/indicator.model");
const Controller = require("./indicatorSubmission.controller");

const TEACHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const STRANGER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const QA_ID = "cccccccccccccccccccccccc";
const INDICATOR_ID = "dddddddddddddddddddddddd";

const chainQuery = (doc) => {
  const q = Promise.resolve(doc);
  q.populate = jest.fn(() => q);
  q.exec = jest.fn().mockResolvedValue(doc);
  return q;
};

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const makeReq = (overrides = {}) => ({
  params: {},
  query: {},
  body: {},
  scope: {},
  ...overrides,
});

afterEach(() => jest.restoreAllMocks());

describe("findOneSubmission — IDOR himoyasi (D-041)", () => {
  test("begona o'qituvchi → 404 (403 emas — oracle oldini olish)", async () => {
    jest.spyOn(IndicatorSubmission, "findById").mockReturnValue(
      chainQuery({ _id: "sub-1", teacher: TEACHER_ID }),
    );
    const req = makeReq({
      params: { id: "sub-1" },
      user: { _id: STRANGER_ID, role: { title: "oqituvchi" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.findOneSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "not found" });
  });

  test("o'ziniki (creator) → muvaffaqiyatli 200", async () => {
    const doc = { _id: "sub-1", teacher: TEACHER_ID };
    jest.spyOn(IndicatorSubmission, "findById").mockReturnValue(chainQuery(doc));
    const req = makeReq({
      params: { id: "sub-1" },
      user: { _id: TEACHER_ID, role: { title: "oqituvchi" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.findOneSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(doc);
  });

  test("talim_sifati_nazorati (tekshiruvchi) → begona bo'lsa ham 200", async () => {
    const doc = { _id: "sub-1", teacher: TEACHER_ID };
    jest.spyOn(IndicatorSubmission, "findById").mockReturnValue(chainQuery(doc));
    const req = makeReq({
      params: { id: "sub-1" },
      user: { _id: QA_ID, role: { title: "talim_sifati_nazorati" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.findOneSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(doc);
  });

  test("topilmagan submission → 404", async () => {
    jest.spyOn(IndicatorSubmission, "findById").mockReturnValue(chainQuery(null));
    const req = makeReq({
      params: { id: "yoq" },
      user: { _id: STRANGER_ID, role: { title: "oqituvchi" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.findOneSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("reviewSubmission — SoD + hisoblangan score (D-042)", () => {
  test("yaratuvchi o'z submission'ini review qilishga urinsa → 403", async () => {
    jest.spyOn(IndicatorSubmission, "findById").mockReturnValue(
      chainQuery({ _id: "sub-1", teacher: TEACHER_ID, authorShare: 100 }),
    );
    const updateSpy = jest.spyOn(IndicatorSubmission, "findByIdAndUpdate");
    const req = makeReq({
      params: { id: "sub-1" },
      body: { status: "approved" },
      user: { _id: TEACHER_ID, role: { title: "talim_sifati_nazorati" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.reviewSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  test("qonuniy reviewer (creator emas) → 200, score = coefficient x (authorShare/100)", async () => {
    jest.spyOn(IndicatorSubmission, "findById").mockReturnValue(
      chainQuery({
        _id: "sub-1",
        teacher: TEACHER_ID,
        authorShare: 50,
        indicator: { coefficient: 5 },
      }),
    );
    const updateSpy = jest
      .spyOn(IndicatorSubmission, "findByIdAndUpdate")
      .mockResolvedValue({ _id: "sub-1", status: "approved" });

    const req = makeReq({
      params: { id: "sub-1" },
      body: { status: "approved", comment: "ok" },
      user: { _id: QA_ID, role: { title: "talim_sifati_nazorati" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.reviewSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateSpy).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ status: "approved", score: 2.5, authorShare: 50 }),
      { new: true },
    );
  });

  test("`score` so'rov tanasidan qabul qilinmaydi — hisoblangan qiymat saqlanadi", async () => {
    jest.spyOn(IndicatorSubmission, "findById").mockReturnValue(
      chainQuery({
        _id: "sub-1",
        teacher: TEACHER_ID,
        authorShare: 100,
        indicator: { coefficient: 3 },
      }),
    );
    const updateSpy = jest
      .spyOn(IndicatorSubmission, "findByIdAndUpdate")
      .mockResolvedValue({ _id: "sub-1", status: "approved" });

    const req = makeReq({
      params: { id: "sub-1" },
      body: { status: "approved", score: 9999 },
      user: { _id: QA_ID, role: { title: "talim_sifati_nazorati" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.reviewSubmission(req, res, next);

    expect(updateSpy).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ score: 3 }),
      { new: true },
    );
  });
});

describe("addSubmission — nofaol indikator (D-042)", () => {
  test("indicator.active === false → 400, save() chaqirilmaydi", async () => {
    jest.spyOn(Indicator, "findById").mockResolvedValue({
      _id: INDICATOR_ID,
      active: false,
    });
    const saveSpy = jest.spyOn(IndicatorSubmission.prototype, "save");

    const req = makeReq({
      body: { indicator: INDICATOR_ID, authorShare: 100 },
      user: { _id: TEACHER_ID, role: { title: "oqituvchi" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.addSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test("indicator topilmasa → 404, save() chaqirilmaydi", async () => {
    jest.spyOn(Indicator, "findById").mockResolvedValue(null);
    const saveSpy = jest.spyOn(IndicatorSubmission.prototype, "save");

    const req = makeReq({
      body: { indicator: INDICATOR_ID, authorShare: 100 },
      user: { _id: TEACHER_ID, role: { title: "oqituvchi" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.addSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test("indicator.active === true → save() chaqiriladi, 201", async () => {
    jest.spyOn(Indicator, "findById").mockResolvedValue({
      _id: INDICATOR_ID,
      active: true,
    });
    jest
      .spyOn(IndicatorSubmission.prototype, "save")
      .mockResolvedValue({ _id: "sub-new" });

    const req = makeReq({
      body: { indicator: INDICATOR_ID, authorShare: 100 },
      user: { _id: TEACHER_ID, role: { title: "oqituvchi" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.addSubmission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("findAllSubmissions / paginateSubmissions — scope tarjimasi (QA topilma 2026-08-06)", () => {
  test("findAllSubmissions: req.scope={user:id} → find() {teacher:id} bilan chaqiriladi", async () => {
    const findSpy = jest.spyOn(IndicatorSubmission, "find").mockReturnValue(chainQuery([]));
    const req = makeReq({
      query: {},
      scope: { user: TEACHER_ID },
      user: { _id: TEACHER_ID, role: { title: "oqituvchi" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.findAllSubmissions(req, res, next);

    expect(findSpy).toHaveBeenCalledWith({ teacher: TEACHER_ID });
  });

  test("findAllSubmissions: bypass (talim_sifati_nazorati) → req.scope={} → filtr bo'sh qoladi", async () => {
    const findSpy = jest.spyOn(IndicatorSubmission, "find").mockReturnValue(chainQuery([]));
    const req = makeReq({
      query: {},
      scope: {},
      user: { _id: QA_ID, role: { title: "talim_sifati_nazorati" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.findAllSubmissions(req, res, next);

    expect(findSpy).toHaveBeenCalledWith({});
  });

  test("paginateSubmissions: req.scope={user:id} → paginate() {teacher:id} bilan chaqiriladi", async () => {
    const paginateSpy = jest
      .spyOn(IndicatorSubmission, "paginate")
      .mockResolvedValue({ docs: [], totalDocs: 0 });
    const req = makeReq({
      query: { page: 1, limit: 10 },
      scope: { user: TEACHER_ID },
      user: { _id: TEACHER_ID, role: { title: "oqituvchi" } },
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.paginateSubmissions(req, res, next);

    expect(paginateSpy).toHaveBeenCalledWith(
      { teacher: TEACHER_ID },
      expect.any(Object),
    );
  });
});
