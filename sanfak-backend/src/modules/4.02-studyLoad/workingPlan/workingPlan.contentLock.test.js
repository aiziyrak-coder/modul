jest.mock("#shared/pythonParser", () => ({
  parseReja: jest.fn(),
  fileUrlToPath: jest.fn(),
}));
jest.mock("#references/_services/educationActivityResolver", () => ({
  enrichMetaWithSlugRefs: jest.fn(),
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./workingPlan.controller");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const WS_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const BLOCK_ID = "111111111111111111111111";
const SCIENCE_ID = "222222222222222222222222";

const makeReq = (scope = {}) => ({
  params: { id: PLAN_ID },
  body: {
    semKey: "1",
    parentId: BLOCK_ID,
    _id: SCIENCE_ID,
    totalCredit: 6,
  },
  scope,
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockLean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
const mockSelectLean = (value) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

const makePlanDoc = () => {
  const science = { _id: SCIENCE_ID, particle: [], set: jest.fn() };
  return {
    _science: science,
    semesters: new Map([
      ["1", { blocks: [{ _id: BLOCK_ID, sciences: [science] }] }],
    ]),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
};

const mockSelectLeanExec = (value) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    }),
  }),
});

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("updateStudyPlanScince — kontent qulfi", () => {
  test.each(["in_review", "approved"])(
    "%s holatida 400 qaytaradi va YOZUV qilmaydi",
    async (status) => {
      jest
        .spyOn(WorkingPlanModel, "findOne")
        .mockReturnValue(mockLean({ _id: PLAN_ID, workingSchedule: WS_ID }));
      jest
        .spyOn(WorkingScheduleModel, "findById")
        .mockReturnValue(mockSelectLean({ status }));

      const next = jest.fn();
      await Controller.updateStudyPlanScince(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toContain(status);
      expect(WorkingPlanModel.findOne).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["draft", "rejected"])("%s holatida o'tadi", async (status) => {
    const planDoc = makePlanDoc();
    let call = 0;
    jest.spyOn(WorkingPlanModel, "findOne").mockImplementation(() => {
      call += 1;
      if (call === 1) return mockLean({ _id: PLAN_ID, workingSchedule: WS_ID });
      if (call === 2) return planDoc;
      return mockSelectLeanExec({ _id: PLAN_ID });
    });
    jest
      .spyOn(WorkingScheduleModel, "findById")
      .mockReturnValue(mockSelectLean({ status }));

    const next = jest.fn();
    const res = makeRes();
    await Controller.updateStudyPlanScince(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(planDoc.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("status o'qishdan OLDINGI qidiruv `req.scope` bilan cheklanadi", async () => {
    const findOne = jest
      .spyOn(WorkingPlanModel, "findOne")
      .mockReturnValue(mockLean(null));

    const res = makeRes();
    await Controller.updateStudyPlanScince(
      makeReq({ workingSchedule: { $in: ["ws-1"] } }),
      res,
      jest.fn(),
    );

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ workingSchedule: { $in: ["ws-1"] } }),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
