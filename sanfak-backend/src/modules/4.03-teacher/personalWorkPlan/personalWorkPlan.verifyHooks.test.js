jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getRecipients: jest.fn().mockResolvedValue([]),
  getRecipientsForSteps: jest.fn().mockResolvedValue([]),
  describeOwner: jest.fn().mockResolvedValue(""),
}));
jest.mock("./personalWorkPlan.model");
jest.mock("#modules/4.03-teacher/_verify/workPlanVerify.service", () => ({
  issueOrRefresh: jest.fn().mockResolvedValue(null),
  revoke: jest.fn(),
}));

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const verify = require("#modules/4.03-teacher/_verify/workPlanVerify.service");
const service = require("./personalWorkPlan.service");
const { ROLES } = require("#config/constants");

const TEACHER = { _id: "cccccccccccccccccccccccc", role: { title: ROLES.OQITUVCHI } };
const STEPS = ["teacher", "kafedraUslubiy", "kafedraIlmiy", "kafedraUstozShogird", "kafedraMudiri", "oquvUslubiy", "dekan", "ichkiNazorat"];

const makePlan = (status, stepStatus = {}) => {
  const plan = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    teacher: TEACHER._id,
    status,
    approvals: STEPS.map((step) => ({ step, label: step, status: stepStatus[step] || "pending", approvedBy: null, date: null })),
    verify: {},
    save: jest.fn().mockResolvedValue(undefined),
  };
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(plan);
  return plan;
};

beforeEach(() => jest.clearAllMocks());

describe("ADR-047 — zanjir hook'lari", () => {
  test("submit: issueOrRefresh SAVE'DAN OLDIN chaqiriladi", async () => {
    const plan = makePlan("draft");
    await service.submit(plan._id, TEACHER, {});
    expect(verify.issueOrRefresh).toHaveBeenCalledWith(plan, TEACHER._id);
    expect(verify.issueOrRefresh.mock.invocationCallOrder[0]).toBeLessThan(plan.save.mock.invocationCallOrder[0]);
  });

  test("approve (draft, 1-bosqich) — issueOrRefresh; token xatosi (null) tasdiqni to'xtatmaydi", async () => {
    const plan = makePlan("draft");
    verify.issueOrRefresh.mockResolvedValueOnce(null);
    await service.approve(plan._id, TEACHER, {}, {});
    expect(verify.issueOrRefresh).toHaveBeenCalledTimes(1);
    expect(plan.save).toHaveBeenCalledTimes(1);
    expect(plan.status).toBe("submitted");
  });

  test("reject: token bekor qilinadi (revoke) save'dan OLDIN, issueOrRefresh chaqirilmaydi", async () => {
    const plan = makePlan("submitted", { teacher: "approved" });
    const superAdmin = { _id: "dddddddddddddddddddddddd", role: { title: ROLES.SUPER_ADMIN } };
    await service.reject(plan._id, superAdmin, {}, { step: "kafedraUslubiy", comment: "sabab" });
    expect(plan.status).toBe("rejected");
    expect(verify.revoke).toHaveBeenCalledWith(plan, "rejected");
    expect(verify.revoke.mock.invocationCallOrder[0]).toBeLessThan(plan.save.mock.invocationCallOrder[0]);
    expect(verify.issueOrRefresh).not.toHaveBeenCalled();
  });
});
