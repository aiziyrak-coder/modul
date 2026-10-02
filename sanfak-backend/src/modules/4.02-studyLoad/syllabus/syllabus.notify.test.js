jest.mock("./syllabus.model");
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const Syllabus = require("./syllabus.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Controller = require("./syllabus.controller");
const { ROLES } = require("#config/constants");

const SYLLABUS_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDoc = (overrides = {}) => ({
  _id: SYLLABUS_ID,
  author: { teacher: TEACHER_ID },
  scienceLabel: "Ichki kasalliklar propedevtikasi",
  status: "in_review",
  approvalSteps: [
    { step: "kafedra", status: "approved" },
    { step: "arm", status: "approved" },
    { step: "methodical", status: "approved" },
    { step: "dean", status: "approved" },
    { step: "prorektor", status: "pending" },
  ],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const runApprove = async (doc, roleTitle) => {
  Syllabus.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.approve(
    {
      params: { id: SYLLABUS_ID },
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

const runReject = async (doc, roleTitle, comment = "Mavzular to'liq emas") => {
  Syllabus.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.reject(
    {
      params: { id: SYLLABUS_ID },
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

describe("syllabus.controller.approve — oxirgi bosqich (prorektor) → syllabus_approved", () => {
  test("prorektor tasdiqlasa muallifga xabar ketadi", async () => {
    const doc = makeDoc();
    await runApprove(doc, ROLES.PROREKTOR);

    expect(doc.status).toBe("approved");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEACHER_ID,
        eventType: "syllabus_approved",
        link: `/study-load/syllabi/${SYLLABUS_ID}/edit`,
      }),
    );
  });

  test("oraliq bosqich (arm) tasdiqlansa HALI bildirishnoma YO'Q", async () => {
    const doc = makeDoc({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "pending" },
        { step: "methodical", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.ARM);

    expect(doc.status).toBe("in_review");
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("syllabus.controller.reject — istalgan bosqich → syllabus_rejected", () => {
  test("muallifga sabab bilan xabar ketadi", async () => {
    const doc = makeDoc({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "approved" },
        { step: "methodical", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runReject(doc, ROLES.OQUV_USLUBIY_BOSHQARMA, "Mavzular to'liq emas");

    expect(doc.status).toBe("rejected");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEACHER_ID,
        eventType: "syllabus_rejected",
        body: "Mavzular to'liq emas",
        link: `/study-load/syllabi/${SYLLABUS_ID}/edit`,
      }),
    );
  });

  test("bildirishnoma xato bersa ham javob muvaffaqiyatli qaytadi (best-effort)", async () => {
    dispatch.mockRejectedValueOnce(new Error("dispatch xato"));
    const doc = makeDoc({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "pending" },
        { step: "methodical", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    const { res, next } = await runReject(doc, ROLES.ARM);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("rejected");
  });
});
