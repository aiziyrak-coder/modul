jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const WorkloadDistribution = require("./workloadDistribution.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Controller = require("./workloadDistribution.controller");
const { ROLES } = require("#config/constants");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEPT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const HEAD_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDist = (overrides = {}) => ({
  _id: DIST_ID,
  department: DEPT_ID,
  title: "Ichki kasalliklar propedevtikasi kafedrasi taqsimoti",
  status: "in_review",
  teachers: [],
  approvalSteps: [
    { step: "kafedra", status: "approved" },
    { step: "methodical", status: "approved" },
    { step: "financial", status: "approved" },
    { step: "dean", status: "approved" },
    { step: "prorektor", status: "pending" },
  ],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const runApprove = async (dist, roleTitle) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  const next = jest.fn();
  const res = createRes();
  await Controller.approve(
    {
      params: { id: DIST_ID },
      body: {},
      query: {},
      scope: {},
      user: { _id: "u-actor", role: { title: roleTitle } },
    },
    res,
    next,
  );
  return { next, res, dist };
};

const runReject = async (dist, roleTitle, comment = "Soatlar noto'g'ri") => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  const next = jest.fn();
  const res = createRes();
  await Controller.reject(
    {
      params: { id: DIST_ID },
      body: { comment },
      query: {},
      scope: {},
      user: { _id: "u-actor", role: { title: roleTitle } },
    },
    res,
    next,
  );
  return { next, res, dist };
};

beforeEach(() => {
  jest.clearAllMocks();
  UserModel.find = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: HEAD_ID, role: { title: ROLES.KAFEDRA_MUDIRI } },
        ]),
      }),
    }),
  });
});

describe("workloadDistribution.controller.approve — oxirgi bosqich (prorektor) → workload_approved", () => {
  test("prorektor tasdiqlasa kafedra mudiriga xabar ketadi", async () => {
    const dist = makeDist();
    await runApprove(dist, ROLES.PROREKTOR);

    expect(dist.status).toBe("approved");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: HEAD_ID,
        eventType: "workload_approved",
        link: `/study-load/distributions/${DIST_ID}`,
      }),
    );
  });

  test("oraliq bosqich (financial) tasdiqlansa HALI bildirishnoma YO'Q", async () => {
    const dist = makeDist({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "methodical", status: "approved" },
        { step: "financial", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runApprove(dist, ROLES.REJA_MOLIYA);

    expect(dist.status).toBe("in_review");
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("workloadDistribution.controller.reject — istalgan bosqich → workload_rejected", () => {
  test("kafedra mudiriga sabab bilan xabar ketadi", async () => {
    const dist = makeDist({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "methodical", status: "approved" },
        { step: "financial", status: "approved" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runReject(dist, ROLES.DEKAN, "Soatlar noto'g'ri");

    expect(dist.status).toBe("rejected");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: HEAD_ID,
        eventType: "workload_rejected",
        body: "Soatlar noto'g'ri",
        link: `/study-load/distributions/${DIST_ID}`,
      }),
    );
  });

  test("bildirishnoma xato bersa ham javob muvaffaqiyatli qaytadi (best-effort)", async () => {
    dispatch.mockRejectedValueOnce(new Error("dispatch xato"));
    const dist = makeDist({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "methodical", status: "approved" },
        { step: "financial", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    const { res, next } = await runReject(dist, ROLES.REJA_MOLIYA);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(dist.status).toBe("rejected");
  });
});
