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
const service = require("./personalWorkPlan.service");
const { ROLES } = require("#config/constants");
const { GROUPS: CHAIN_GROUPS } = require("#modules/4.03-teacher/_shared/workPlanChain");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "cccccccccccccccccccccccc";
const SCOPE = { teacher: { $in: [TEACHER_ID] } };

const STEP_KEYS = [
  "teacher",
  "kafedraUslubiy",
  "kafedraIlmiy",
  "kafedraUstozShogird",
  "kafedraMudiri",
  "oquvUslubiy",
  "dekan",
  "ichkiNazorat",
];

const userWithRole = (title, id = "userid") => ({ _id: id, role: { title } });

const priorApproved = (step) => {
  const idx = CHAIN_GROUPS.findIndex((g) => g.steps.includes(step));
  const overrides = {};
  CHAIN_GROUPS.slice(0, idx).forEach((g) =>
    g.steps.forEach((s) => {
      overrides[s] = "approved";
    }),
  );
  return overrides;
};

const buildApprovals = (overrides = {}) =>
  STEP_KEYS.map((step) => ({
    step,
    label: step,
    status: overrides[step] || "pending",
    approvedBy: null,
    date: null,
    comment: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
  }));

const planDoc = ({ status = "submitted", approvals } = {}) => ({
  _id: PLAN_ID,
  teacher: TEACHER_ID,
  status,
  approvals: approvals || buildApprovals(),
  save: jest.fn().mockResolvedValue(undefined),
});

const mockFound = (doc) => {
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(doc);
};

const entryOf = (doc, step) => doc.approvals.find((s) => s.step === step);

beforeEach(() => jest.clearAllMocks());

describe("personalWorkPlan.service.approve — tasdiqlash izohi (F-21)", () => {
  test("`comment` berilsa — `approvals[i].comment` saqlanadi va DB'ga yoziladi", async () => {
    const doc = planDoc({ approvals: buildApprovals(priorApproved("kafedraMudiri")) });
    mockFound(doc);

    await service.approve(
      PLAN_ID,
      userWithRole(ROLES.KAFEDRA_MUDIRI, "mudir-1"),
      SCOPE,
      { comment: "Bo'lim IV to'ldirilishi kerak" },
    );

    expect(entryOf(doc, "kafedraMudiri").comment).toBe(
      "Bo'lim IV to'ldirilishi kerak",
    );
    expect(entryOf(doc, "kafedraMudiri").status).toBe("approved");
    expect(doc.save).toHaveBeenCalled();
  });

  test("`comment` BERILMASA — `null` qoladi (regressiya: ustidan yozilmaydi)", async () => {
    const doc = planDoc({ approvals: buildApprovals(priorApproved("kafedraMudiri")) });
    mockFound(doc);

    await service.approve(
      PLAN_ID,
      userWithRole(ROLES.KAFEDRA_MUDIRI, "mudir-1"),
      SCOPE,
      {},
    );

    expect(entryOf(doc, "kafedraMudiri").comment).toBeNull();
    expect(entryOf(doc, "kafedraMudiri").status).toBe("approved");
  });

  test("bo'sh satr `\"\"` → `null` (timeline bo'sh izoh bloki chizmasin)", async () => {
    const doc = planDoc({ approvals: buildApprovals(priorApproved("kafedraMudiri")) });
    mockFound(doc);

    await service.approve(
      PLAN_ID,
      userWithRole(ROLES.KAFEDRA_MUDIRI, "mudir-1"),
      SCOPE,
      { comment: "" },
    );

    expect(entryOf(doc, "kafedraMudiri").comment).toBeNull();
  });

  test("1-bosqich (o'qituvchi, draft) — izoh u yerda ham saqlanadi", async () => {
    const doc = planDoc({ status: "draft" });
    mockFound(doc);

    await service.approve(
      PLAN_ID,
      userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
      SCOPE,
      { comment: "O'zim tasdiqladim" },
    );

    expect(entryOf(doc, "teacher").comment).toBe("O'zim tasdiqladim");
  });

  test("`submit()` — `comment` tegilmaydi (body `{}` bilan chaqiriladi)", async () => {
    const doc = planDoc({ status: "draft" });
    mockFound(doc);

    await service.submit(PLAN_ID, userWithRole(ROLES.OQITUVCHI, TEACHER_ID), SCOPE);

    expect(entryOf(doc, "teacher").comment).toBeNull();
    expect(entryOf(doc, "teacher").status).toBe("approved");
  });
});
