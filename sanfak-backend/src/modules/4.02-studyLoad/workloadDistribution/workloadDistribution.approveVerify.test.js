"use strict";

jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service");
jest.mock("./workloadDistribution.supersede", () => ({
  supersedePreviousDistributions: jest.fn().mockResolvedValue(0),
}));

const WorkloadDistributionModel = require("./workloadDistribution.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const {
  issueToken,
  revoke,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
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

const callOrder = [];

const makeDoc = (overrides = {}) => ({
  _id: DIST_ID,
  department: DEPT_ID,
  title: "Test taqsimoti",
  status: "in_review",
  teachers: [],
  approvalSteps: [
    { step: "kafedra", status: "approved" },
    { step: "methodical", status: "approved" },
    { step: "financial", status: "approved" },
    { step: "dean", status: "approved" },
    { step: "prorektor", status: "pending" },
  ],
  save: jest.fn().mockImplementation(async () => {
    callOrder.push("save");
  }),
  ...overrides,
});

const runApprove = async (doc, roleTitle, body = {}) => {
  WorkloadDistributionModel.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.approve(
    {
      params: { id: DIST_ID },
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
  WorkloadDistributionModel.findOne = jest.fn().mockResolvedValue(doc);
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
  return { next, res, doc };
};

const runWithdraw = async (doc, roleTitle) => {
  WorkloadDistributionModel.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.withdraw(
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
  return { next, res, doc };
};

beforeEach(() => {
  jest.clearAllMocks();
  callOrder.length = 0;
  UserModel.find = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: HEAD_ID, role: { title: ROLES.KAFEDRA_MUDIRI } },
        ]),
      }),
    }),
  });
  issueToken.mockImplementation(async () => {
    callOrder.push("issueToken");
    return "tok123";
  });
});

describe("workloadDistribution.controller.approve — issueToken doc.save() dan OLDIN", () => {
  test("oxirgi bosqich (prorektor) tasdiqlansa — issueToken → save tartibida chaqiriladi", async () => {
    const doc = makeDoc();
    await runApprove(doc, ROLES.PROREKTOR);

    expect(doc.status).toBe("approved");
    expect(issueToken).toHaveBeenCalledTimes(1);
    expect(issueToken).toHaveBeenCalledWith(doc, "u-actor");
    expect(callOrder).toEqual(["issueToken", "save"]);
  });

  test("oraliq bosqich tasdiqlansa (hali approved emas) — issueToken CHAQIRILMAYDI", async () => {
    const doc = makeDoc({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "methodical", status: "pending" },
        { step: "financial", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(doc.status).toBe("in_review");
    expect(issueToken).not.toHaveBeenCalled();
  });
});

describe("workloadDistribution.controller.approve — token xatosi tasdiqni BLOKLAMAYDI", () => {
  test("issueToken reject bo'lsa ham — hujjat baribir approved, 200 javob", async () => {
    issueToken.mockRejectedValueOnce(new Error("token servis xato"));
    const doc = makeDoc();
    const { res, next } = await runApprove(doc, ROLES.PROREKTOR);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("approved");
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("workloadDistribution.controller.reject — revoke chaqiriladi (Qaror #8, simmetriya)", () => {
  test("in_review → rejected — revoke(doc, ...) save()dan oldin chaqiriladi", async () => {
    revoke.mockImplementation(() => callOrder.push("revoke"));
    const doc = makeDoc({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "methodical", status: "approved" },
        { step: "financial", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runReject(doc, ROLES.REJA_MOLIYA, "Hisob xato");

    expect(doc.status).toBe("rejected");
    expect(revoke).toHaveBeenCalledWith(doc, "Rad etildi");
    expect(callOrder).toEqual(["revoke", "save"]);
  });
});

describe("workloadDistribution.controller.approve — reopen (rejected → draft) — revoke chaqiriladi", () => {
  test("kafedra mudiri rad etilgan taqsimotni qayta ochsa — revoke(doc, ...) chaqiriladi", async () => {
    revoke.mockImplementation(() => callOrder.push("revoke"));
    const doc = makeDoc({
      status: "rejected",
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "methodical", status: "rejected", comment: "x" },
        { step: "financial", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.KAFEDRA_MUDIRI);

    expect(doc.status).toBe("draft");
    expect(revoke).toHaveBeenCalledWith(doc, "Qayta ochildi");
    expect(callOrder).toEqual(["revoke", "save"]);
  });
});

describe("workloadDistribution.controller.withdraw — revoke chaqiriladi (invariant simmetriyasi)", () => {
  test("in_review → draft (qaytarib olish) — revoke(doc, ...) chaqiriladi", async () => {
    revoke.mockImplementation(() => callOrder.push("revoke"));
    const doc = makeDoc({
      status: "in_review",
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "methodical", status: "pending" },
        { step: "financial", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runWithdraw(doc, ROLES.KAFEDRA_MUDIRI);

    expect(doc.status).toBe("draft");
    expect(revoke).toHaveBeenCalledWith(doc, "Qaytarib olindi");
    expect(callOrder).toEqual(["revoke", "save"]);
  });
});
