jest.mock("./workingSchedule.model");

const WorkingScheduleModel = require("./workingSchedule.model");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (roleTitle, scope = {}, query = {}) => ({
  query,
  params: {},
  body: {},
  scope,
  user: { _id: "507f1f77bcf86cd799439011", role: { title: roleTitle } },
});

const capturePaginateFilter = async (roleTitle, scope = {}, query = {}) => {
  WorkingScheduleModel.paginate = jest.fn().mockResolvedValue({ docs: [] });
  const res = createRes();
  await Controller.paginate(createReq(roleTitle, scope, query), res, jest.fn());
  expect(WorkingScheduleModel.paginate).toHaveBeenCalled();
  return WorkingScheduleModel.paginate.mock.calls[0][0];
};

const priorStepsOf = (filter) =>
  filter?.approvalHistory?.$not?.$elemMatch?.step?.$in ?? null;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Zanjir ko'rinishi — har rol o'z bosqichigacha yetgan rejani ko'radi", () => {
  test("O'UB (methodical, 1-bosqich): oldingi bosqich yo'q ⇒ ko'rinish filtri QO'YILMAYDI", async () => {
    const filter = await capturePaginateFilter(ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.$expr).toBeUndefined();
  });

  test("Dekan: `methodical` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.DEKAN, {
      direction: { $in: ["dddddddddddddddddddddddd"] },
    });

    expect(priorStepsOf(filter)).toEqual(["methodical"]);
    expect(filter.approvalHistory.$not.$elemMatch.status).toEqual({
      $ne: "approved",
    });
    expect(filter.direction).toEqual({ $in: ["dddddddddddddddddddddddd"] });
  });

  test("Prorektor: `methodical` + `dean` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.PROREKTOR);
    expect(priorStepsOf(filter)).toEqual(["methodical", "dean"]);
  });

  test("Rektor (oxirgi bosqich): undan oldingi 3 bosqich", async () => {
    const filter = await capturePaginateFilter(ROLES.REKTOR);
    expect(priorStepsOf(filter)).toEqual(["methodical", "dean", "prorektor"]);
  });
});

describe("Zanjirda bosqichi YO'Q rol — hech narsa ko'rmaydi (fail-closed)", () => {
  const BLOCKED = { $eq: [1, 0] };

  test("Rol nomi noma'lum bo'lsa ham fail-closed (yangi rol qo'shilsa avtomatik yopiq)", async () => {
    const filter = await capturePaginateFilter("kelgusi_yangi_rol");
    expect(filter.$expr).toEqual(BLOCKED);
  });

  test("Detail (`findOne`) ham yopiq — ID bilan ochib bo'lmaydi (IDOR)", async () => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
    };
    chain.then = (resolve) => Promise.resolve(null).then(resolve);
    WorkingScheduleModel.findOne = jest.fn().mockReturnValue(chain);

    const req = createReq("kelgusi_yangi_rol");
    req.params.id = "cccccccccccccccccccccccc";
    const next = jest.fn();
    await Controller.findOne(req, {}, next);

    const filter = WorkingScheduleModel.findOne.mock.calls[0][0];
    expect(filter._id).toBe("cccccccccccccccccccccccc");
    expect(filter.$expr).toEqual({ $eq: [1, 0] });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});

describe("Tizim rollari — bypass", () => {
  test("super_admin: ko'rinish filtri qo'yilmaydi", async () => {
    const filter = await capturePaginateFilter(ROLES.SUPER_ADMIN);
    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.$expr).toBeUndefined();
  });

  test("moderator: ko'rinish filtri qo'yilmaydi", async () => {
    const filter = await capturePaginateFilter(ROLES.MODERATOR);
    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.$expr).toBeUndefined();
  });
});

describe("Kuzatuvchi (observerRoles) — bosqichi yo'q, lekin ro'yxatni to'liq ko'radi", () => {
  test("Kafedra mudiri: zanjir bosqichi sharti yo'q, draftVisibility+observer $and bilan birlashadi", async () => {
    const filter = await capturePaginateFilter(ROLES.KAFEDRA_MUDIRI);

    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.$expr).toBeUndefined();

    expect(filter.$and).toBeDefined();
    const statusConditions = filter.$and.map((f) => f.status);
    expect(statusConditions).toContainEqual({ $nin: ["draft", "new"] });
    expect(statusConditions).toContainEqual({ $nin: ["draft", "rejected"] });
  });

  test("Kuzatuvchi `?status=draft` bilan ataylab so'rasa ham — draftVisibility avval yopadi, observer $and bilan qo'shiladi", async () => {
    const filter = await capturePaginateFilter(ROLES.KAFEDRA_MUDIRI, {}, {
      status: "draft",
    });

    expect(filter.$and).toBeDefined();
    const statusConditions = filter.$and.map((f) => f.status);
    expect(statusConditions).toContainEqual({ $in: [] });
    expect(statusConditions).toContainEqual({ $nin: ["draft", "rejected"] });
  });
});

describe("MUTATSIYA QULFI — filtr olib tashlansa test qulashi kerak", () => {
  test("rad etilgan `dean` bosqichi keyingi rolga KO'RINMASLIGI filtr bilan ta'minlanadi", async () => {
    const filter = await capturePaginateFilter(ROLES.PROREKTOR);
    const prior = priorStepsOf(filter);

    expect(prior).toContain("dean");
    expect(filter.approvalHistory.$not.$elemMatch.status.$ne).toBe("approved");
  });
});
