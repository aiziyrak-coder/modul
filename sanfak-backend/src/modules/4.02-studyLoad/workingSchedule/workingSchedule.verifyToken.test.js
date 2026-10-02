jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service", () => ({
  issueOrRefresh: jest.fn().mockResolvedValue("a".repeat(32)),
  revoke: jest.fn(),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");
const {
  issueOrRefresh,
  revoke,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");

const DOC_ID = "cccccccccccccccccccccccc";
const REKTOR_ID = "333333333333333333333333";
const GLOBAL_SCOPE = {};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseDoc = (status, overrides = {}) => ({
  _id: DOC_ID,
  status,
  approvalHistory: [
    { step: "methodical", status: "pending" },
    { step: "rektor", status: "pending" },
  ],
  agreed: { viceRector: null, date: null },
  confirmation: { rector: null, date: null },
  methodicalHead: { leader: null, date: null },
  facultyDean: { dean: null, date: null },
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const callApprove = async (doc, user) => {
  jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
  const res = createRes();
  const next = jest.fn();
  await Controller.approve({ params: { id: DOC_ID }, body: {}, scope: GLOBAL_SCOPE, user }, res, next);
  expect(next).not.toHaveBeenCalled();
  return res;
};

afterEach(() => jest.restoreAllMocks());
beforeEach(() => jest.clearAllMocks());

describe("approve — issueOrRefresh HAR imzoda, save()dan OLDIN (ADR-039)", () => {
  test("submit (draft → in_review) — issueOrRefresh(doc, userId), keyin save", async () => {
    jest.spyOn(WorkingPlanModel, "find").mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    const doc = baseDoc("draft");
    doc.save.mockImplementation(() => expect(issueOrRefresh).toHaveBeenCalledTimes(1));
    await callApprove(doc, { _id: "m1", role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } });
    expect(doc.status).toBe("in_review");
    expect(issueOrRefresh).toHaveBeenCalledWith(doc, "m1");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("oraliq bosqich (allDone EMAS) — issueOrRefresh ENDI chaqiriladi (eski qoida o'zgardi)", async () => {
    const doc = baseDoc("in_review");
    await callApprove(doc, { _id: "m1", role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } });
    expect(doc.status).toBe("in_review");
    expect(issueOrRefresh).toHaveBeenCalledTimes(1);
    expect(issueOrRefresh).toHaveBeenCalledWith(doc, "m1");
  });

  test("yakuniy bosqich — approved + issueOrRefresh(doc, userId), save()dan OLDIN", async () => {
    const doc = baseDoc("in_review", { approvalHistory: [{ step: "rektor", status: "pending" }] });
    doc.save.mockImplementation(() => expect(issueOrRefresh).toHaveBeenCalledTimes(1));
    await callApprove(doc, { _id: REKTOR_ID, role: { title: ROLES.REKTOR } });
    expect(doc.status).toBe("approved");
    expect(issueOrRefresh).toHaveBeenCalledWith(doc, REKTOR_ID);
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("issueOrRefresh xato bersa ham — tasdiqlash zanjiri BLOKLANMAYDI (ADR-020 SHART #4)", async () => {
    issueOrRefresh.mockRejectedValueOnce(new Error("db xato"));
    const doc = baseDoc("in_review", { approvalHistory: [{ step: "rektor", status: "pending" }] });
    const res = await callApprove(doc, { _id: REKTOR_ID, role: { title: ROLES.REKTOR } });
    expect(doc.status).toBe("approved");
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("reopen (rejected → draft) — revoke chaqiriladi", () => {
  test("revoke(doc, 'Qayta ochildi') save()dan OLDIN chaqiriladi, token CHIQMAYDI", async () => {
    const doc = baseDoc("rejected");
    await callApprove(doc, { _id: "u1", role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } });
    expect(doc.status).toBe("draft");
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith(doc, "Qayta ochildi");
    expect(issueOrRefresh).not.toHaveBeenCalled();
    expect(doc.save).toHaveBeenCalledTimes(1);
  });
});

describe("reject (in_review → rejected) — revoke chaqiriladi", () => {
  test("revoke(doc, 'Rad etildi') save()dan OLDIN chaqiriladi", async () => {
    const doc = baseDoc("in_review", {
      approvalHistory: [{ step: "rektor", status: "pending" }],
    });
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    const next = jest.fn();

    await Controller.reject(
      {
        params: { id: DOC_ID },
        body: { comment: "sabab" },
        scope: GLOBAL_SCOPE,
        user: { _id: REKTOR_ID, role: { title: ROLES.REKTOR } },
      },
      createRes(),
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("rejected");
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith(doc, "Rad etildi");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });
});
