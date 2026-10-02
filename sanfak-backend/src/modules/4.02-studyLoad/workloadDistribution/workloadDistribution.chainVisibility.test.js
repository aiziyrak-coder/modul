jest.mock("./workloadDistribution.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");
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
  WorkloadDistribution.paginate = jest.fn().mockResolvedValue({ docs: [] });
  const res = createRes();
  await Controller.paginateWorkloadDistributions(
    createReq(roleTitle, scope, query),
    res,
    jest.fn(),
  );
  expect(WorkloadDistribution.paginate).toHaveBeenCalled();
  return WorkloadDistribution.paginate.mock.calls[0][0];
};

const priorStepsOf = (filter) =>
  filter?.approvalSteps?.$not?.$elemMatch?.step?.$in ?? null;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Zanjir ko'rinishi — har rol o'z bosqichigacha yetgan taqsimotni ko'radi", () => {
  test("Kafedra mudiri (kafedra, 1-bosqich): oldingi bosqich yo'q ⇒ ko'rinish filtri QO'YILMAYDI", async () => {
    const filter = await capturePaginateFilter(ROLES.KAFEDRA_MUDIRI);

    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.$expr).toBeUndefined();
  });

  test("O'quv-uslubiy boshqarma: `kafedra` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.OQUV_USLUBIY_BOSHQARMA, {
      department: { $in: ["dddddddddddddddddddddddd"] },
    });

    expect(priorStepsOf(filter)).toEqual(["kafedra"]);
    expect(filter.approvalSteps.$not.$elemMatch.status).toEqual({
      $ne: "approved",
    });
    expect(filter.department).toEqual({ $in: ["dddddddddddddddddddddddd"] });
  });

  test("Reja-moliya: `kafedra` + `methodical` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.REJA_MOLIYA);
    expect(priorStepsOf(filter)).toEqual(["kafedra", "methodical"]);
  });

  test("Dekan: undan oldingi 3 bosqich", async () => {
    const filter = await capturePaginateFilter(ROLES.DEKAN);
    expect(priorStepsOf(filter)).toEqual(["kafedra", "methodical", "financial"]);
  });

  test("Prorektor (oxirgi bosqich): undan oldingi 4 bosqich", async () => {
    const filter = await capturePaginateFilter(ROLES.PROREKTOR);
    expect(priorStepsOf(filter)).toEqual([
      "kafedra",
      "methodical",
      "financial",
      "dean",
    ]);
  });
});

describe("Zanjirda bosqichi YO'Q rol — hech narsa ko'rmaydi (fail-closed)", () => {
  const BLOCKED = { $eq: [1, 0] };

  test("Rol nomi noma'lum bo'lsa ham fail-closed (yangi rol qo'shilsa avtomatik yopiq)", async () => {
    const filter = await capturePaginateFilter("kelgusi_yangi_rol");
    expect(filter.$expr).toEqual(BLOCKED);
  });

  test("Detail (`findOneWorkloadDistribution`) ham yopiq — ID bilan ochib bo'lmaydi (IDOR)", async () => {
    WorkloadDistribution.findOne = jest.fn().mockReturnValue({
      populate: () => ({ exec: () => Promise.resolve(null) }),
    });

    const req = createReq("kelgusi_yangi_rol");
    req.params.id = "cccccccccccccccccccccccc";
    const res = createRes();
    await Controller.findOneWorkloadDistribution(req, res, jest.fn());

    const filter = WorkloadDistribution.findOne.mock.calls[0][0];
    expect(filter._id).toBe("cccccccccccccccccccccccc");
    expect(filter.$expr).toEqual(BLOCKED);
    expect(res.status).toHaveBeenCalledWith(404);
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
  test("Kadrlar: zanjir bosqichi sharti yo'q, faqat status cheklovi ($nin draft/new/rejected)", async () => {
    const filter = await capturePaginateFilter(ROLES.KADRLAR);

    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.$expr).toBeUndefined();
    expect(filter.$and).toBeDefined();
    const statusConditions = filter.$and.map((f) => f.status);
    expect(statusConditions).toContainEqual({ $nin: ["draft", "new"] });
    expect(statusConditions).toContainEqual({
      $nin: ["draft", "new", "rejected"],
    });
  });

  test("Rektor: kuzatuvchi sifatida — zanjir bosqichi sharti yo'q", async () => {
    const filter = await capturePaginateFilter(ROLES.REKTOR);

    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.$expr).toBeUndefined();
    expect(filter.$and).toBeDefined();
  });

  test("O'qituvchi: o'z entry'lari doirasida (scope) + observer status cheklovi", async () => {
    const filter = await capturePaginateFilter(ROLES.OQITUVCHI, {
      "teachers.teacher": "507f1f77bcf86cd799439011",
    });

    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.$and).toBeDefined();
    const scopeCondition = filter.$and.find(
      (f) => f["teachers.teacher"] !== undefined,
    );
    expect(scopeCondition["teachers.teacher"]).toBe(
      "507f1f77bcf86cd799439011",
    );
  });
});

describe("MUTATSIYA QULFI — filtr olib tashlansa test qulashi kerak", () => {
  test("rad etilgan `methodical` bosqichi keyingi rolga KO'RINMASLIGI filtr bilan ta'minlanadi", async () => {
    const filter = await capturePaginateFilter(ROLES.REJA_MOLIYA);
    const prior = priorStepsOf(filter);

    expect(prior).toContain("methodical");
    expect(filter.approvalSteps.$not.$elemMatch.status.$ne).toBe("approved");
  });
});
