jest.mock("./personalWorkPlan.model");
jest.mock("#modules/4.03-teacher/_verify/workPlanVerify.service", () => ({
  issueOrRefresh: jest.fn().mockResolvedValue(null),
  revoke: jest.fn(),
}));
jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getRecipients: jest.fn().mockResolvedValue([]),
  getRecipientsForSteps: jest.fn().mockResolvedValue([]),
  describeOwner: jest.fn().mockResolvedValue(""),
}));

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const service = require("./personalWorkPlan.service");
const { ROLES } = require("#config/constants");
const {
  ROLE_STEP,
  isGroupComplete,
} = require("#modules/4.03-teacher/_shared/workPlanChain");
const { APPROVAL_STEP_KEYS } = require("./personalWorkPlan.validation");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "cccccccccccccccccccccccc";
const SCOPE = {};

const STEP_ROLE = Object.fromEntries(
  Object.entries(ROLE_STEP).map(([role, step]) => [step, role]),
);

const buildApprovals = (overrides = {}) =>
  APPROVAL_STEP_KEYS.map((step) => ({
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

const planDoc = ({ status = "submitted", approvals, teacher = TEACHER_ID } = {}) => ({
  _id: PLAN_ID,
  teacher,
  status,
  approvals: approvals || buildApprovals(),
  save: jest.fn().mockResolvedValue(undefined),
});

const mockFound = (doc) => {
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(doc);
};

const userWithRole = (title, id = "userid") => ({ _id: id, role: { title } });

beforeEach(() => jest.clearAllMocks());

describe("canApprove guard — G2 (kafedraMudiri) G1 tugamasdan approve", () => {
  test("409 qaytaradi, holat o'zgarmaydi", async () => {
    const doc = planDoc({ approvals: buildApprovals({ teacher: "approved" }) });
    mockFound(doc);

    await expect(
      service.approve(PLAN_ID, userWithRole(ROLES.KAFEDRA_MUDIRI), SCOPE, {}),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(doc.approvals.find((s) => s.step === "kafedraMudiri").status).toBe(
      "pending",
    );
    expect(doc.status).toBe("submitted");
  });

  test("xabarda navbatdagi guruh nomi ko'rsatiladi", async () => {
    const doc = planDoc({ approvals: buildApprovals({ teacher: "approved" }) });
    mockFound(doc);

    await expect(
      service.approve(PLAN_ID, userWithRole(ROLES.KAFEDRA_MUDIRI), SCOPE, {}),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Navbat hali kelmagan/),
    });
  });

  test("super_admin — G1 tugamasdan HAM `body.step` bilan istalgan bosqichni tasdiqlaydi", async () => {
    const doc = planDoc({ approvals: buildApprovals({ teacher: "approved" }) });
    mockFound(doc);

    await service.approve(PLAN_ID, userWithRole(ROLES.SUPER_ADMIN), SCOPE, {
      step: "oquvUslubiy",
    });

    expect(doc.approvals.find((s) => s.step === "oquvUslubiy").status).toBe(
      "approved",
    );
    expect(doc.approvals.find((s) => s.step === "kafedraMudiri").status).toBe(
      "pending",
    );
  });

  test("G3 (oquvUslubiy) — G2 tugamasdan HAM 409 (nafaqat bevosita oldingi guruh)", async () => {
    const doc = planDoc({
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
      }),
    });
    mockFound(doc);

    await expect(
      service.approve(PLAN_ID, userWithRole(ROLES.OQUV_USLUBIY_BOSHQARMA), SCOPE, {}),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("reject ham xuddi shu guruh navbati qoidasiga bo'ysunadi — G1 tugamasdan G2 rad eta olmaydi", async () => {
    const doc = planDoc({ approvals: buildApprovals({ teacher: "approved" }) });
    mockFound(doc);

    await expect(
      service.reject(PLAN_ID, userWithRole(ROLES.KAFEDRA_MUDIRI), SCOPE, {
        comment: "yetarli emas",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(doc.status).toBe("submitted");
  });
});

describe("G1 ICHIDA tartib yo'q — istalgan tartibda, natija bir xil", () => {
  const orders = [
    ["kafedraUslubiy", "kafedraIlmiy", "kafedraUstozShogird"],
    ["kafedraUstozShogird", "kafedraUslubiy", "kafedraIlmiy"],
    ["kafedraIlmiy", "kafedraUstozShogird", "kafedraUslubiy"],
  ];

  test.each(orders)(
    "tartib: %s -> %s -> %s — hammasi approved bo'ladi, G1 to'liq tugaydi",
    async (...order) => {
      const doc = planDoc({ approvals: buildApprovals({ teacher: "approved" }) });
      mockFound(doc);

      for (const step of order) {
        const { entry } = await service.approve(
          PLAN_ID,
          userWithRole(STEP_ROLE[step]),
          SCOPE,
          {},
        );
        expect(entry.status).toBe("approved");
      }

      expect(isGroupComplete(doc, 1)).toBe(true);
      expect(doc.status).toBe("submitted");
    },
  );
});

describe("To'liq zanjir — G0 dan G5 gacha ketma-ket, oxirida `approved`", () => {
  test("har guruh o'z navbatida — oxirgi (ichkiNazorat) tasdiqlagach reja `approved`ga o'tadi", async () => {
    const doc = planDoc({ status: "draft", approvals: buildApprovals() });
    mockFound(doc);

    await service.approve(PLAN_ID, userWithRole(ROLES.OQITUVCHI, TEACHER_ID), SCOPE, {});
    expect(doc.status).toBe("submitted");

    for (const step of ["kafedraUslubiy", "kafedraIlmiy", "kafedraUstozShogird"]) {
      await service.approve(PLAN_ID, userWithRole(STEP_ROLE[step]), SCOPE, {});
    }
    expect(doc.status).toBe("submitted");

    for (const step of ["kafedraMudiri", "oquvUslubiy", "dekan"]) {
      const { plan } = await service.approve(
        PLAN_ID,
        userWithRole(STEP_ROLE[step]),
        SCOPE,
        {},
      );
      expect(plan.status).toBe("submitted");
    }

    const { plan } = await service.approve(
      PLAN_ID,
      userWithRole(ROLES.ICHKI_NAZORAT),
      SCOPE,
      {},
    );
    expect(plan.status).toBe("approved");
    expect(plan.approvedBy).toBeTruthy();
  });
});

describe("rad etish + reopen — guruh holati to'liq tozalanadi", () => {
  test("G2 rad etadi -> reopen -> BARCHA bosqich pending, G1 qaytadan G0 tugagach ochiladi", async () => {
    const rejectedDoc = planDoc({
      status: "rejected",
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
        kafedraMudiri: "rejected",
      }),
    });
    mockFound(rejectedDoc);

    const { plan } = await service.reopen(
      PLAN_ID,
      userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
      SCOPE,
    );

    expect(plan.status).toBe("draft");
    expect(plan.approvals.every((s) => s.status === "pending")).toBe(true);

    plan.status = "submitted";
    plan.approvals.find((s) => s.step === "teacher").status = "approved";
    mockFound(plan);

    await expect(
      service.approve(PLAN_ID, userWithRole(ROLES.KAFEDRA_MUDIRI), SCOPE, {}),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
