jest.mock("./workload.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const WorkloadModel = require("./workload.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Controller = require("./workload.controller");
const { ROLES } = require("#config/constants");

const WORKLOAD_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEPT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const HEAD_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDoc = (overrides = {}) => ({
  _id: WORKLOAD_ID,
  department: DEPT_ID,
  title: "Ichki kasalliklar propedevtikasi kafedrasining 2026/2027 o'quv yili uchun soatlar hisobi",
  status: "in_review",
  approvalSteps: [
    { step: "methodical", status: "approved" },
    { step: "kafedra", status: "approved" },
    { step: "financial", status: "approved" },
    { step: "prorektor", status: "approved" },
    { step: "rektor", status: "pending" },
  ],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const runApprove = async (doc, roleTitle, body = {}) => {
  WorkloadModel.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.approve(
    {
      params: { id: WORKLOAD_ID },
      body,
      query: {},
      scope: {},
      user: { _id: "u-actor", role: { title: roleTitle } },
    },
    res,
    next,
  );
  return { next, res, doc };
};

const runReject = async (doc, roleTitle, comment = "Hisob xato") => {
  WorkloadModel.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.reject(
    {
      params: { id: WORKLOAD_ID },
      body: { comment },
      query: {},
      scope: {},
      user: { _id: "u-actor", role: { title: roleTitle } },
    },
    res,
    next,
  );
  return { next, res, doc };
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

describe("workload.controller.approve — oxirgi bosqich → workload_approved", () => {
  test("rektor (oxirgi bosqich) tasdiqlasa kafedra mudiriga xabar ketadi", async () => {
    const doc = makeDoc();
    await runApprove(doc, ROLES.REKTOR);

    expect(doc.status).toBe("approved");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: HEAD_ID,
        eventType: "workload_approved",
        link: `/study-load/workloads/${WORKLOAD_ID}`,
      }),
    );
  });

  test("oraliq bosqich (kafedra) tasdiqlansa HALI bildirishnoma YO'Q", async () => {
    const doc = makeDoc({
      approvalSteps: [
        { step: "methodical", status: "approved" },
        { step: "kafedra", status: "pending" },
        { step: "financial", status: "pending" },
        { step: "prorektor", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.KAFEDRA_MUDIRI);

    expect(doc.status).toBe("in_review");
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("workload.controller.reject — istalgan bosqich → workload_rejected", () => {
  test("kafedra mudiriga sabab bilan xabar ketadi", async () => {
    const doc = makeDoc({
      approvalSteps: [
        { step: "methodical", status: "approved" },
        { step: "kafedra", status: "approved" },
        { step: "financial", status: "pending" },
        { step: "prorektor", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
    });
    await runReject(doc, ROLES.REJA_MOLIYA, "Hisob xato");

    expect(doc.status).toBe("rejected");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: HEAD_ID,
        eventType: "workload_rejected",
        body: "Hisob xato",
        link: `/study-load/workloads/${WORKLOAD_ID}`,
      }),
    );
  });

  test("bildirishnoma xato bersa ham javob muvaffaqiyatli qaytadi (best-effort)", async () => {
    dispatch.mockRejectedValueOnce(new Error("dispatch xato"));
    const doc = makeDoc({
      approvalSteps: [
        { step: "methodical", status: "approved" },
        { step: "kafedra", status: "pending" },
        { step: "financial", status: "pending" },
        { step: "prorektor", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
    });
    const { res, next } = await runReject(doc, ROLES.KAFEDRA_MUDIRI);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("rejected");
  });
});
