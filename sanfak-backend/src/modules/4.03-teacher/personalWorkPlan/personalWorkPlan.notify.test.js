jest.mock("./personalWorkPlan.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#modules/4.01-auth/role/role.model");
jest.mock("#references/department/department.model");
jest.mock("#references/academicYear/academicYear.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const Department = require("#references/department/department.model");
const AcademicYear = require("#references/academicYear/academicYear.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const service = require("./personalWorkPlan.service");
const { ROLES } = require("#config/constants");
const { ROLE_STEP } = require("#modules/4.03-teacher/_shared/workPlanChain");
const { APPROVAL_STEP_KEYS } = require("./personalWorkPlan.validation");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "cccccccccccccccccccccccc";
const DEPT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const FACULTY_ID = "dddddddddddddddddddddddd";
const YEAR_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const SCOPE = {};

const STEP_ROLE = Object.fromEntries(
  Object.entries(ROLE_STEP).map(([role, step]) => [step, role]),
);

const roleId = (title) => `role-${title}`;
const userIdFor = (title) => `user-${title}`;
const recipientOf = (step) => userIdFor(STEP_ROLE[step]);

const chain = (result) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(result),
  }),
});

const buildApprovals = (overrides = {}) =>
  APPROVAL_STEP_KEYS.map((step) => ({
    step,
    label: step,
    status: overrides[step] || "pending",
  }));

const planDoc = ({ status = "submitted", approvals } = {}) => ({
  _id: PLAN_ID,
  teacher: TEACHER_ID,
  academicYear: YEAR_ID,
  status,
  approvals: approvals || buildApprovals(),
  save: jest.fn().mockResolvedValue(undefined),
});

const mockFound = (doc) => {
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(doc);
};

const userWithRole = (title) => ({
  _id: title === ROLES.OQITUVCHI ? TEACHER_ID : `actor-${title}`,
  role: { title },
});

const dispatchedTo = () => dispatch.mock.calls.map((c) => c[0].userId).sort();
const firstPayload = () => dispatch.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();

  Role.find = jest.fn((filter) =>
    chain((filter?.title?.$in || []).map((title) => ({ _id: roleId(title) }))),
  );
  User.find = jest.fn((filter) =>
    chain(
      (filter?.role?.$in || []).map((rid) => ({
        _id: userIdFor(String(rid).replace(/^role-/, "")),
      })),
    ),
  );
  User.findById = jest.fn(() => chain({ department: DEPT_ID, faculty: null }));
  Department.findById = jest.fn(() => chain({ faculty: FACULTY_ID }));
  Department.find = jest.fn(() => chain([{ _id: DEPT_ID }]));
  AcademicYear.findById = jest.fn(() => chain({ title: "2026/2027" }));
});

describe("submit() — draft -> submitted: G1 (kafedra bloki) xabar oladi", () => {
  test("3 ta kafedra mas'uliga `personalWorkPlan_submitted` ketadi", async () => {
    const doc = planDoc({ status: "draft" });
    mockFound(doc);

    await service.submit(PLAN_ID, userWithRole(ROLES.OQITUVCHI), SCOPE);

    expect(doc.status).toBe("submitted");
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatchedTo()).toEqual(
      [
        recipientOf("kafedraUslubiy"),
        recipientOf("kafedraIlmiy"),
        recipientOf("kafedraUstozShogird"),
      ].sort(),
    );
    expect(firstPayload()).toMatchObject({
      eventType: "personalWorkPlan_submitted",
      link: "/teacher/work-plans/inbox",
      metadata: { planId: PLAN_ID, group: "G1" },
    });
    expect(firstPayload().body).toContain("2026/2027");
  });

  test("G1 qabul qiluvchilari egasining KAFEDRASIDAN olinadi", async () => {
    const doc = planDoc({ status: "draft" });
    mockFound(doc);

    await service.submit(PLAN_ID, userWithRole(ROLES.OQITUVCHI), SCOPE);

    expect(User.findById).toHaveBeenCalledWith(TEACHER_ID);
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ department: DEPT_ID, active: true }),
    );
  });

  test("PATCH /approve orqali ham (draft, `teacher` bosqichi) xabar ketadi", async () => {
    const doc = planDoc({ status: "draft" });
    mockFound(doc);

    await service.approve(PLAN_ID, userWithRole(ROLES.OQITUVCHI), SCOPE, {});

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(firstPayload().eventType).toBe("personalWorkPlan_submitted");
  });
});

describe("approveChainStep() — GURUH CHEGARASI (asosiy regressiya qulfi)", () => {
  test("G1 ichidagi 1-imzodan keyin HECH KIMGA xabar ketmaydi", async () => {
    const doc = planDoc({ approvals: buildApprovals({ teacher: "approved" }) });
    mockFound(doc);

    await service.approve(
      PLAN_ID,
      userWithRole(ROLES.KAFEDRA_USLUBIY_MASUL),
      SCOPE,
      {},
    );

    expect(doc.approvals.find((s) => s.step === "kafedraUslubiy").status).toBe(
      "approved",
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("G1 ning 3-imzosidan keyin G2 (kafedra mudiri) xabar oladi", async () => {
    const doc = planDoc({
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
      }),
    });
    mockFound(doc);

    await service.approve(
      PLAN_ID,
      userWithRole(ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL),
      SCOPE,
      {},
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(firstPayload()).toMatchObject({
      userId: recipientOf("kafedraMudiri"),
      eventType: "personalWorkPlan_stepPending",
      link: "/teacher/work-plans/inbox",
      metadata: { planId: PLAN_ID, group: "G2" },
    });
  });

  test("G2 -> G3: O'UB GLOBAL darajada topiladi (kafedra cheklovisiz)", async () => {
    const doc = planDoc({
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
      }),
    });
    mockFound(doc);

    await service.approve(PLAN_ID, userWithRole(ROLES.KAFEDRA_MUDIRI), SCOPE, {});

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(firstPayload().userId).toBe(recipientOf("oquvUslubiy"));
    expect(User.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ department: DEPT_ID }),
    );
  });

  test("G3 -> G4: dekan o'qituvchining FAKULTETI bo'yicha topiladi", async () => {
    const doc = planDoc({
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
        kafedraMudiri: "approved",
      }),
    });
    mockFound(doc);

    await service.approve(
      PLAN_ID,
      userWithRole(ROLES.OQUV_USLUBIY_BOSHQARMA),
      SCOPE,
      {},
    );

    expect(firstPayload().userId).toBe(recipientOf("dekan"));
    expect(Department.findById).toHaveBeenCalledWith(DEPT_ID);
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { faculty: FACULTY_ID },
          { department: { $in: [DEPT_ID] } },
        ],
      }),
    );
  });

  test("G4 -> G5: ichki nazorat xabar oladi", async () => {
    const doc = planDoc({
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
        kafedraMudiri: "approved",
        oquvUslubiy: "approved",
      }),
    });
    mockFound(doc);

    await service.approve(PLAN_ID, userWithRole(ROLES.DEKAN), SCOPE, {});

    expect(firstPayload()).toMatchObject({
      userId: recipientOf("ichkiNazorat"),
      eventType: "personalWorkPlan_stepPending",
      metadata: { group: "G5" },
    });
  });
});

describe("zanjir yakuni — reja EGASIGA xabar", () => {
  const lastStepDoc = () =>
    planDoc({
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
        kafedraMudiri: "approved",
        oquvUslubiy: "approved",
        dekan: "approved",
      }),
    });

  test("oxirgi imzo — `personalWorkPlan_approved` faqat o'qituvchiga", async () => {
    const doc = lastStepDoc();
    mockFound(doc);

    await service.approve(PLAN_ID, userWithRole(ROLES.ICHKI_NAZORAT), SCOPE, {});

    expect(doc.status).toBe("approved");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(firstPayload()).toMatchObject({
      userId: TEACHER_ID,
      eventType: "personalWorkPlan_approved",
      link: `/teacher/work-plans/${PLAN_ID}`,
      metadata: { planId: PLAN_ID, step: "ichkiNazorat" },
    });
  });

  test("rad etilsa — `personalWorkPlan_rejected` sabab bilan o'qituvchiga", async () => {
    const doc = planDoc({
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
      }),
    });
    mockFound(doc);

    await service.reject(PLAN_ID, userWithRole(ROLES.KAFEDRA_MUDIRI), SCOPE, {
      comment: "I bo'lim to'ldirilmagan",
    });

    expect(doc.status).toBe("rejected");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(firstPayload()).toMatchObject({
      userId: TEACHER_ID,
      eventType: "personalWorkPlan_rejected",
      link: `/teacher/work-plans/${PLAN_ID}`,
    });
    expect(firstPayload().body).toContain("I bo'lim to'ldirilmagan");
  });
});

describe("best-effort — bildirishnoma amalni BLOKLAMAYDI", () => {
  test("dispatch xato bersa submit baribir muvaffaqiyatli", async () => {
    dispatch.mockRejectedValue(new Error("socket down"));
    const doc = planDoc({ status: "draft" });
    mockFound(doc);

    const { plan } = await service.submit(
      PLAN_ID,
      userWithRole(ROLES.OQITUVCHI),
      SCOPE,
    );

    expect(plan.status).toBe("submitted");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("qabul qiluvchi qidiruvi xato bersa approve baribir muvaffaqiyatli", async () => {
    Role.find = jest.fn(() => {
      throw new Error("connection lost");
    });
    const doc = planDoc({ approvals: buildApprovals({ teacher: "approved" }) });
    mockFound(doc);

    const { entry } = await service.approve(
      PLAN_ID,
      userWithRole(ROLES.KAFEDRA_USLUBIY_MASUL),
      SCOPE,
      {},
    );

    expect(entry.status).toBe("approved");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("rol bo'sh (qabul qiluvchi yo'q) — 0 dispatch, xato yo'q", async () => {
    Role.find = jest.fn(() => chain([]));
    const doc = planDoc({ status: "draft" });
    mockFound(doc);

    await service.submit(PLAN_ID, userWithRole(ROLES.OQITUVCHI), SCOPE);

    expect(dispatch).not.toHaveBeenCalled();
    expect(doc.status).toBe("submitted");
  });
});
