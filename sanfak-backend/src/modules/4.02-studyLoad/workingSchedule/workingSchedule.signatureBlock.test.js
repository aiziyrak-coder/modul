jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const APPROVER_ID = "333333333333333333333333";
const GLOBAL_SCOPE = {};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildDoc = (pendingStep, overrides = {}) => {
  const STEPS = ["methodical", "dean", "prorektor", "rektor"];
  const idx = STEPS.indexOf(pendingStep);
  return {
    _id: DOC_ID,
    status: "in_review",
    approvalHistory: STEPS.map((step, i) => ({
      step,
      status: i < idx ? "approved" : "pending",
    })),
    agreed: { viceRector: null, date: "202__yil template" },
    confirmation: { rector: null, date: "202__yil template" },
    methodicalHead: { leader: null, date: null },
    facultyDean: { dean: null, date: null },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

const ROLE_BY_STEP = {
  methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
  dean: ROLES.DEKAN,
  prorektor: ROLES.PROREKTOR,
  rektor: ROLES.REKTOR,
};

afterEach(() => jest.restoreAllMocks());

describe("workingSchedule.approve — top-level imzo bloki to'ldirilishi", () => {
  test("methodical tasdiqlansa — methodicalHead.leader/date to'ladi, boshqa bloklar bo'sh qoladi", async () => {
    const doc = buildDoc("methodical");
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    const res = createRes();

    await Controller.approve(
      {
        params: { id: DOC_ID },
        body: {},
        scope: GLOBAL_SCOPE,
        user: { _id: APPROVER_ID, role: { title: ROLE_BY_STEP.methodical } },
      },
      res,
      jest.fn(),
    );

    expect(doc.methodicalHead.leader).toBe(APPROVER_ID);
    expect(doc.methodicalHead.date).toEqual(expect.any(String));
    expect(doc.facultyDean.dean).toBeNull();
    expect(doc.agreed.viceRector).toBeNull();
    expect(doc.confirmation.rector).toBeNull();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("dean tasdiqlansa — facultyDean.dean/date to'ladi, methodicalHead o'zgarmaydi", async () => {
    const doc = buildDoc("dean");
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);

    await Controller.approve(
      {
        params: { id: DOC_ID },
        body: {},
        scope: GLOBAL_SCOPE,
        user: { _id: APPROVER_ID, role: { title: ROLE_BY_STEP.dean } },
      },
      createRes(),
      jest.fn(),
    );

    expect(doc.facultyDean.dean).toBe(APPROVER_ID);
    expect(doc.facultyDean.date).toEqual(expect.any(String));
    expect(doc.methodicalHead.leader).toBeNull();
    expect(doc.agreed.viceRector).toBeNull();
    expect(doc.confirmation.rector).toBeNull();
  });

  test("prorektor tasdiqlansa — agreed.viceRector/date to'ladi", async () => {
    const doc = buildDoc("prorektor");
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);

    await Controller.approve(
      {
        params: { id: DOC_ID },
        body: {},
        scope: GLOBAL_SCOPE,
        user: { _id: APPROVER_ID, role: { title: ROLE_BY_STEP.prorektor } },
      },
      createRes(),
      jest.fn(),
    );

    expect(doc.agreed.viceRector).toBe(APPROVER_ID);
    expect(doc.agreed.date).toEqual(expect.any(String));
    expect(doc.confirmation.rector).toBeNull();
  });

  test("rektor tasdiqlansa (oxirgi bosqich) — confirmation.rector/date to'ladi va status 'approved' bo'ladi", async () => {
    const doc = buildDoc("rektor");
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);

    await Controller.approve(
      {
        params: { id: DOC_ID },
        body: {},
        scope: GLOBAL_SCOPE,
        user: { _id: APPROVER_ID, role: { title: ROLE_BY_STEP.rektor } },
      },
      createRes(),
      jest.fn(),
    );

    expect(doc.confirmation.rector).toBe(APPROVER_ID);
    expect(doc.confirmation.date).toEqual(expect.any(String));
    expect(doc.status).toBe("approved");
  });
});

describe("workingSchedule.reject — top-level imzo blokiga tegmaydi", () => {
  test("joriy pending step rad etilsa — hech qaysi top-level blok o'zgarmaydi", async () => {
    const doc = buildDoc("dean");
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    const res = createRes();

    await Controller.reject(
      {
        params: { id: DOC_ID },
        body: { comment: "kamchilik bor" },
        scope: GLOBAL_SCOPE,
        user: { _id: APPROVER_ID, role: { title: ROLE_BY_STEP.dean } },
      },
      res,
      jest.fn(),
    );

    expect(doc.methodicalHead.leader).toBeNull();
    expect(doc.facultyDean.dean).toBeNull();
    expect(doc.agreed.viceRector).toBeNull();
    expect(doc.confirmation.rector).toBeNull();
    expect(doc.status).toBe("rejected");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("workingSchedule.approve — reopen (rejected -> draft) top-level bloklarni reset qiladi", () => {
  test("oldingi tsiklda to'lgan methodicalHead/facultyDean reopen'da tozalanadi", async () => {
    const doc = buildDoc("prorektor", {
      status: "rejected",
      methodicalHead: { leader: APPROVER_ID, date: "2026-08-01" },
      facultyDean: { dean: APPROVER_ID, date: "2026-08-02" },
    });
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    const res = createRes();

    await Controller.approve(
      {
        params: { id: DOC_ID },
        body: {},
        scope: GLOBAL_SCOPE,
        user: {
          _id: APPROVER_ID,
          role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA },
        },
      },
      res,
      jest.fn(),
    );

    expect(doc.status).toBe("draft");
    expect(doc.methodicalHead.leader).toBeNull();
    expect(doc.methodicalHead.date).toBeNull();
    expect(doc.facultyDean.dean).toBeNull();
    expect(doc.facultyDean.date).toBeNull();
    expect(doc.agreed.viceRector).toBeNull();
    expect(doc.confirmation.rector).toBeNull();
  });
});
