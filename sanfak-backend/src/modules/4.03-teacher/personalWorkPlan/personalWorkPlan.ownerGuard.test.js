jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");
const { ROLES } = require("#config/constants");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ACT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const OWNER_ID = "cccccccccccccccccccccccc";
const COLLEAGUE_ID = "dddddddddddddddddddddddd";
const DEPARTMENT_SCOPE = { teacher: { $in: [OWNER_ID, COLLEAGUE_ID] } };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const userWithRole = (title, id) => ({ _id: id, role: { title } });

beforeEach(() => jest.clearAllMocks());

describe("updateWorkPlan / deleteWorkPlan — egalik (findOne(lean/limited) yo'li)", () => {
  const mockLeanFindOne = (doc) => {
    PersonalWorkPlanModel.findOne = jest.fn().mockReturnValue(
      doc === undefined
        ? Promise.resolve(null)
        : { lean: () => Promise.resolve(doc) },
    );
  };

  test("updateWorkPlan — egasi (draft) — 200", async () => {
    PersonalWorkPlanModel.findOne = jest
      .fn()
      .mockResolvedValue({ _id: PLAN_ID, status: "draft", teacher: OWNER_ID });
    PersonalWorkPlanModel.findOneAndUpdate = jest.fn().mockResolvedValue({});
    const res = createRes();
    const next = jest.fn();

    await Controller.updateWorkPlan(
      {
        params: { id: PLAN_ID },
        body: { name: "yangi" },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("updateWorkPlan — hamkasb (begona egalik) — 403, DB'ga yozilmaydi", async () => {
    PersonalWorkPlanModel.findOne = jest
      .fn()
      .mockResolvedValue({ _id: PLAN_ID, status: "draft", teacher: OWNER_ID });
    PersonalWorkPlanModel.findOneAndUpdate = jest.fn();
    const next = jest.fn();

    await Controller.updateWorkPlan(
      {
        params: { id: PLAN_ID },
        body: { name: "hack" },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
      },
      createRes(),
      next,
    );

    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(PersonalWorkPlanModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("updateWorkPlan — super_admin — egalik tekshiruvidan OZOD (o'z holatiga o'tadi)", async () => {
    PersonalWorkPlanModel.findOne = jest
      .fn()
      .mockResolvedValue({ _id: PLAN_ID, status: "draft", teacher: OWNER_ID });
    PersonalWorkPlanModel.findOneAndUpdate = jest.fn().mockResolvedValue({});
    const res = createRes();
    const next = jest.fn();

    await Controller.updateWorkPlan(
      {
        params: { id: PLAN_ID },
        body: { name: "admin-edit" },
        scope: {},
        user: userWithRole(ROLES.SUPER_ADMIN, "admin-1"),
      },
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("deleteWorkPlan — egasi (rejected) — 200", async () => {
    mockLeanFindOne({ _id: PLAN_ID, status: "rejected", teacher: OWNER_ID });
    PersonalWorkPlanModel.findOneAndDelete = jest
      .fn()
      .mockResolvedValue({ _id: PLAN_ID });
    const res = createRes();

    await Controller.deleteWorkPlan(
      {
        params: { id: PLAN_ID },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("deleteWorkPlan — hamkasb (begona egalik) — 403, DB'dan o'chirilmaydi", async () => {
    mockLeanFindOne({ _id: PLAN_ID, status: "draft", teacher: OWNER_ID });
    PersonalWorkPlanModel.findOneAndDelete = jest.fn();
    const next = jest.fn();

    await Controller.deleteWorkPlan(
      {
        params: { id: PLAN_ID },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
      },
      createRes(),
      next,
    );

    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(PersonalWorkPlanModel.findOneAndDelete).not.toHaveBeenCalled();
  });
});

describe("addActivity / updateActivity / deleteActivity / completeActivity — egalik", () => {
  const makePlan = (overrides = {}) => {
    const item = { _id: ACT_ID, title: "bor", verification: {} };
    const arr = [item];
    arr.id = jest.fn().mockReturnValue(item);
    arr.pull = jest.fn();
    return {
      _id: PLAN_ID,
      teacher: OWNER_ID,
      status: "draft",
      researchWork: arr,
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
  };

  const reqFor = (user, body = {}) => ({
    params: { id: PLAN_ID, activityId: ACT_ID },
    body: { section: "researchWork", ...body },
    scope: DEPARTMENT_SCOPE,
    user,
  });

  test.each([
    ["addActivity", Controller.addActivity, { item: { title: "yangi" } }],
    ["updateActivity", Controller.updateActivity, { title: "o'zgardi" }],
    ["deleteActivity", Controller.deleteActivity, {}],
    ["completeActivity", Controller.completeActivity, {}],
  ])("%s — egasi — 403 EMAS (o'tadi)", async (_name, handler, body) => {
    PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(makePlan());
    const next = jest.fn();
    const res = createRes();

    await handler(
      reqFor(userWithRole(ROLES.OQITUVCHI, OWNER_ID), body),
      res,
      next,
    );

    if (next.mock.calls.length) {
      expect(next.mock.calls[0][0].statusCode).not.toBe(403);
    }
  });

  test.each([
    ["addActivity", Controller.addActivity, { item: { title: "yangi" } }],
    ["updateActivity", Controller.updateActivity, { title: "o'zgardi" }],
    ["deleteActivity", Controller.deleteActivity, {}],
    ["completeActivity", Controller.completeActivity, {}],
  ])(
    "%s — hamkasb (begona egalik) — 403, plan.save() CHAQIRILMAYDI",
    async (_name, handler, body) => {
      const plan = makePlan();
      PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(plan);
      const next = jest.fn();

      await handler(
        reqFor(userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID), body),
        createRes(),
        next,
      );

      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].message).toBe("Bu hujjat sizga tegishli emas");
      expect(plan.save).not.toHaveBeenCalled();
    },
  );

  test("completeActivity — kafedra_mudiri (tekshiruvchi, egalik shartidan tashqarida) — 403 EMAS", async () => {
    const plan = makePlan();
    PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(plan);
    const next = jest.fn();

    await Controller.completeActivity(
      reqFor(userWithRole(ROLES.KAFEDRA_MUDIRI, "someone-else")),
      createRes(),
      next,
    );

    if (next.mock.calls.length) {
      expect(next.mock.calls[0][0].statusCode).not.toBe(403);
    }
  });
});
