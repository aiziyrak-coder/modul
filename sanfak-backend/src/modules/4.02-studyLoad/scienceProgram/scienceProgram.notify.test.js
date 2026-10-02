jest.mock("./scienceProgram.model", () => {
  const actual = jest.requireActual("./scienceProgram.model");
  return { ...actual, findOne: jest.fn() };
});
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const ScienceProgram = require("./scienceProgram.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Controller = require("./scienceProgram.controller");
const { ROLES } = require("#config/constants");

const SP_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const AUTHOR_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDoc = (overrides = {}) => ({
  _id: SP_ID,
  user: AUTHOR_ID,
  title: "Ichki kasalliklar propedevtikasi",
  formVersion: "v259",
  status: "in_review",
  approvalSteps: [
    { step: "teacher", status: "approved" },
    { step: "kafedra", status: "approved" },
    { step: "arm", status: "approved" },
    { step: "methodical", status: "approved" },
    { step: "prorektor", status: "approved" },
    { step: "rektor", status: "pending" },
  ],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const runApprove = async (doc, roleTitle) => {
  ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.approve(
    {
      params: { id: SP_ID },
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

const runReject = async (doc, roleTitle, comment = "Adabiyotlar ro'yxati yo'q") => {
  ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.reject(
    {
      params: { id: SP_ID },
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
});

describe("scienceProgram.controller.approve — oxirgi bosqich (rektor, v259) → scienceProgram_approved", () => {
  test("rektor tasdiqlasa muallifga xabar ketadi", async () => {
    const doc = makeDoc();
    await runApprove(doc, ROLES.REKTOR);

    expect(doc.status).toBe("approved");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: AUTHOR_ID,
        eventType: "scienceProgram_approved",
        link: `/study-load/science-programs/${SP_ID}/edit`,
      }),
    );
  });

  test("oraliq bosqich (arm) tasdiqlansa HALI bildirishnoma YO'Q", async () => {
    const doc = makeDoc({
      approvalSteps: [
        { step: "teacher", status: "approved" },
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "pending" },
        { step: "methodical", status: "pending" },
        { step: "prorektor", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.ARM);

    expect(doc.status).toBe("in_review");
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("scienceProgram.controller.approve — B1 (v259, oxirgi bosqich dekan) → scienceProgram_approved", () => {
  test("B1: dekan (oxirgi bosqich) tasdiqlasa — approved + muallifga xabar", async () => {
    const doc = makeDoc({
      formVersion: "v259",
      approvalSteps: [
        { step: "teacher", status: "approved" },
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "approved" },
        { step: "methodical", status: "approved" },
        { step: "dean", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.DEKAN);

    expect(doc.status).toBe("approved");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: AUTHOR_ID,
        eventType: "scienceProgram_approved",
      }),
    );
  });

  test("B1: methodical tasdiqlasa — hali in_review (navbat dekanda), bildirishnoma YO'Q", async () => {
    const doc = makeDoc({
      formVersion: "v259",
      approvalSteps: [
        { step: "teacher", status: "approved" },
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "approved" },
        { step: "methodical", status: "pending" },
        { step: "dean", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(doc.status).toBe("in_review");
    expect(doc.approvalSteps[4].status).toBe("pending");
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("scienceProgram.controller.reject — istalgan bosqich → scienceProgram_rejected", () => {
  test("muallifga sabab bilan xabar ketadi", async () => {
    const doc = makeDoc({
      approvalSteps: [
        { step: "teacher", status: "approved" },
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "approved" },
        { step: "methodical", status: "pending" },
        { step: "prorektor", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
    });
    await runReject(doc, ROLES.OQUV_USLUBIY_BOSHQARMA, "Adabiyotlar ro'yxati yo'q");

    expect(doc.status).toBe("rejected");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: AUTHOR_ID,
        eventType: "scienceProgram_rejected",
        body: "Adabiyotlar ro'yxati yo'q",
        link: `/study-load/science-programs/${SP_ID}/edit`,
      }),
    );
  });

  test("bildirishnoma xato bersa ham javob muvaffaqiyatli qaytadi (best-effort)", async () => {
    dispatch.mockRejectedValueOnce(new Error("dispatch xato"));
    const doc = makeDoc({
      approvalSteps: [
        { step: "teacher", status: "approved" },
        { step: "kafedra", status: "pending" },
        { step: "arm", status: "pending" },
        { step: "methodical", status: "pending" },
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
