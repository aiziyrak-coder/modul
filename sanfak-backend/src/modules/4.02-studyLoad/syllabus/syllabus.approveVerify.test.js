"use strict";

jest.mock("./syllabus.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service");

const SyllabusModel = require("./syllabus.model");
const {
  issueToken,
  revoke,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const Controller = require("./syllabus.controller");
const { ROLES } = require("#config/constants");

const SYL_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const callOrder = [];

const makeDoc = (overrides = {}) => ({
  _id: SYL_ID,
  title: "Test sillabusi",
  status: "in_review",
  author: { teacher: null },
  approvalSteps: [
    { step: "kafedra", status: "approved" },
    { step: "arm", status: "approved" },
    { step: "methodical", status: "approved" },
    { step: "dean", status: "approved" },
    { step: "prorektor", status: "pending" },
  ],
  save: jest.fn().mockImplementation(async () => {
    callOrder.push("save");
  }),
  ...overrides,
});

const runApprove = async (doc, roleTitle, body = {}) => {
  SyllabusModel.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.approve(
    {
      params: { id: SYL_ID },
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

const runReject = async (doc, roleTitle, comment = "Xato bor") => {
  SyllabusModel.findOne = jest.fn().mockResolvedValue(doc);
  const next = jest.fn();
  const res = createRes();
  await Controller.reject(
    {
      params: { id: SYL_ID },
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
  callOrder.length = 0;
  issueToken.mockImplementation(async () => {
    callOrder.push("issueToken");
    return "tok123";
  });
});

describe("syllabus.controller.approve — issueToken doc.save() dan OLDIN", () => {
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
        { step: "kafedra", status: "pending" },
        { step: "arm", status: "pending" },
        { step: "methodical", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.KAFEDRA_MUDIRI);

    expect(doc.status).toBe("in_review");
    expect(issueToken).not.toHaveBeenCalled();
  });
});

describe("syllabus.controller.approve — token xatosi tasdiqni BLOKLAMAYDI", () => {
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

describe("syllabus.controller.reject — revoke chaqiriladi (Qaror #8, simmetriya)", () => {
  test("in_review → rejected — revoke(doc, ...) save()dan oldin chaqiriladi", async () => {
    revoke.mockImplementation(() => callOrder.push("revoke"));
    const doc = makeDoc({
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "pending" },
        { step: "methodical", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runReject(doc, ROLES.ARM, "Xato bor");

    expect(doc.status).toBe("rejected");
    expect(revoke).toHaveBeenCalledWith(doc, "Rad etildi");
    expect(callOrder).toEqual(["revoke", "save"]);
  });
});

describe("syllabus.controller.approve — reopen (rejected → draft) — revoke chaqiriladi", () => {
  test("SUPER_ADMIN rad etilgan sillabusni qayta ochsa — revoke(doc, ...) chaqiriladi", async () => {
    revoke.mockImplementation(() => callOrder.push("revoke"));
    const doc = makeDoc({
      status: "rejected",
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "rejected", comment: "x" },
        { step: "methodical", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
      ],
    });
    await runApprove(doc, ROLES.SUPER_ADMIN);

    expect(doc.status).toBe("draft");
    expect(revoke).toHaveBeenCalledWith(doc, "Qayta ochildi");
    expect(callOrder).toEqual(["revoke", "save"]);
  });
});
