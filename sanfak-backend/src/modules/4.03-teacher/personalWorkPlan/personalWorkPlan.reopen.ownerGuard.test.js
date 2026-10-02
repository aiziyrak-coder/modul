jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const service = require("./personalWorkPlan.service");
const { ROLES } = require("#config/constants");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_ID = "cccccccccccccccccccccccc";
const COLLEAGUE_ID = "dddddddddddddddddddddddd";
const DEPARTMENT_SCOPE = { teacher: { $in: [OWNER_ID, COLLEAGUE_ID] } };

const userWithRole = (title, id) => ({ _id: id, role: { title } });

const planDoc = (overrides = {}) => ({
  _id: PLAN_ID,
  teacher: OWNER_ID,
  status: "rejected",
  approvals: [{ step: "teacher", status: "rejected" }],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe("personalWorkPlan.service.reopen — egalik", () => {
  test("egasi — qayta ochadi", async () => {
    const doc = planDoc();
    PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(doc);

    const { plan } = await service.reopen(
      PLAN_ID,
      userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      DEPARTMENT_SCOPE,
    );

    expect(plan.status).toBe("draft");
  });

  test("hamkasb (begona egalik, department scope drift) — 403", async () => {
    const doc = planDoc();
    PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(doc);

    await expect(
      service.reopen(
        PLAN_ID,
        userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
        DEPARTMENT_SCOPE,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Bu hujjat sizga tegishli emas",
    });
    expect(doc.status).toBe("rejected");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("super_admin — egalik tekshiruvidan OZOD", async () => {
    const doc = planDoc();
    PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(doc);

    const { plan } = await service.reopen(
      PLAN_ID,
      userWithRole(ROLES.SUPER_ADMIN, "admin-1"),
      {},
    );

    expect(plan.status).toBe("draft");
  });
});
