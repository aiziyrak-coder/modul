jest.mock("#modules/4.02-studyLoad/_pdf/workingPlan.pdf", () => ({
  generateWorkingPlanPdf: jest.fn((req, res) => res.status(200).json({ pdf: true })),
}));

const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlanModel = require("./workingPlan.model");
const Controller = require("./workingPlan.controller");
const {
  generateWorkingPlanPdf,
} = require("#modules/4.02-studyLoad/_pdf/workingPlan.pdf");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("workingPlan.controller — findOneWorkingPlan (NB-1 scope fix — WorkingScheduleModel!)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("scope doirasidagi _id → topiladi (200), filtrda req.scope (direction) bor", async () => {
    const doc = { _id: "ws1" };
    const spy = jest
      .spyOn(WorkingScheduleModel, "findOne")
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
    const res = createRes();
    const req = { params: { id: "ws1" }, scope: { direction: { $in: ["d1"] } } };

    await Controller.findOneWorkingPlan(req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "ws1", direction: { $in: ["d1"] } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("doira tashqarisidagi _id → 404", async () => {
    jest
      .spyOn(WorkingScheduleModel, "findOne")
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { direction: { $in: [] } } };

    await Controller.findOneWorkingPlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("workingPlan.controller — generatePdf (NB-1 scope fix — WorkingPlanModel, exists-guard)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("doira tashqarisida — exists false → 404, generator CHAQIRILMAYDI", async () => {
    jest.spyOn(WorkingPlanModel, "exists").mockResolvedValue(null);
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { workingSchedule: { $in: [] } } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(generateWorkingPlanPdf).not.toHaveBeenCalled();
  });

  test("doira ichida — exists true → generator chaqiriladi", async () => {
    jest.spyOn(WorkingPlanModel, "exists").mockResolvedValue(true);
    const res = createRes();
    const req = { params: { id: "wp1" }, scope: { workingSchedule: { $in: ["ws1"] } } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(generateWorkingPlanPdf).toHaveBeenCalledWith(req, res, expect.any(Function));
  });
});
