jest.mock("#modules/4.02-studyLoad/_pdf/workingPlan.pdf", () => ({
  buildWorkingRejaDoc: jest.fn(),
}));
jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const Controller = require("./workingSchedule.controller");
const {
  buildWorkingRejaDoc,
} = require("#modules/4.02-studyLoad/_pdf/workingPlan.pdf");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

const populateChain = (resolvedDoc) => {
  const resolvedWithToObject =
    resolvedDoc && typeof resolvedDoc === "object"
      ? { ...resolvedDoc, toObject: () => resolvedDoc }
      : resolvedDoc;
  const q = {};
  q.populate = jest.fn().mockReturnValue(q);
  q.then = (resolve) => Promise.resolve(resolvedWithToObject).then(resolve);
  return q;
};

describe("workingSchedule.controller — findOne (NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("scope doirasidagi _id → topiladi (200), filtrda req.scope (direction) bor", async () => {
    const docObj = { _id: "ws1" };
    const doc = populateChain(docObj);
    const spy = jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue(doc);
    jest.spyOn(WorkingPlanModel, "findOne").mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ semesters: {} }) }),
    });
    const res = createRes();
    const req = { params: { id: "ws1" }, scope: { direction: { $in: ["d1"] } } };

    await Controller.findOne(req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "ws1", direction: { $in: ["d1"] } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("doira tashqarisidagi _id → 404 (next chaqiriladi)", async () => {
    jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue(populateChain(null));
    const next = jest.fn();
    const req = { params: { id: "foreign" }, scope: { direction: { $in: [] } } };

    await Controller.findOne(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(404);
  });
});

describe("workingSchedule.controller — findOneProcess / findOneComposition (NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("findOneProcess — doira tashqarisida → 404", async () => {
    jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const next = jest.fn();
    const req = { params: { id: "foreign" }, scope: { direction: { $in: [] } } };

    await Controller.findOneProcess(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(404);
  });

  test("findOneComposition — doira ichida, filtrda req.scope bor", async () => {
    const doc = { _id: "ws1" };
    const spy = jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
      select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) }),
    });
    const res = createRes();
    const req = { params: { id: "ws1" }, scope: { direction: { $in: ["d1"] } } };

    await Controller.findOneComposition(req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "ws1", direction: { $in: ["d1"] } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("workingSchedule.controller — generatePdf (TO'LIQ hujjat, workingPlan orqali, NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("doira tashqarisida — exists false → 404, WorkingPlan qidirilmaydi, generator CHAQIRILMAYDI", async () => {
    jest.spyOn(WorkingScheduleModel, "exists").mockResolvedValue(null);
    const findOneSpy = jest.spyOn(WorkingPlanModel, "findOne");
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { direction: { $in: [] } } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(findOneSpy).not.toHaveBeenCalled();
    expect(buildWorkingRejaDoc).not.toHaveBeenCalled();
  });

  test("doira ichida, lekin WorkingPlan topilmagan → 404 ErrorHandler (500 emas)", async () => {
    jest.spyOn(WorkingScheduleModel, "exists").mockResolvedValue(true);
    jest
      .spyOn(WorkingPlanModel, "findOne")
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    const next = jest.fn();
    const req = { params: { id: "ws1" }, scope: { direction: { $in: ["d1"] } } };

    await Controller.generatePdf(req, {}, next);

    expect(buildWorkingRejaDoc).not.toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(404);
  });

  test("doira ichida, WorkingPlan topilgan → buildWorkingRejaDoc(workingPlan._id) bilan chaqiriladi", async () => {
    jest.spyOn(WorkingScheduleModel, "exists").mockResolvedValue(true);
    const findOneSpy = jest.spyOn(WorkingPlanModel, "findOne").mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: "wp1" }),
    });
    const fakeDoc = { pipe: jest.fn(), end: jest.fn() };
    buildWorkingRejaDoc.mockResolvedValue(fakeDoc);
    const res = createRes();
    const req = { params: { id: "ws1" }, scope: { direction: { $in: ["d1"] } } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(findOneSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workingSchedule: "ws1" }),
    );
    expect(buildWorkingRejaDoc).toHaveBeenCalledWith("wp1");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(fakeDoc.end).toHaveBeenCalled();
  });
});
