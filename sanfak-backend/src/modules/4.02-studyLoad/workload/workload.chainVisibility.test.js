jest.mock("./workload.model");

const WorkloadModel = require("./workload.model");
const Controller = require("./workload.controller");
const { ROLES } = require("#config/constants");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (roleTitle, scope = {}) => ({
  query: {},
  params: {},
  body: {},
  scope,
  user: { _id: "507f1f77bcf86cd799439011", role: { title: roleTitle } },
});

const capturePaginateFilter = async (roleTitle, scope = {}) => {
  WorkloadModel.paginate = jest.fn().mockResolvedValue({ docs: [] });
  const res = createRes();
  await Controller.paginateWorkloads(createReq(roleTitle, scope), res, jest.fn());
  expect(WorkloadModel.paginate).toHaveBeenCalled();
  return WorkloadModel.paginate.mock.calls[0][0];
};

const priorStepsOf = (filter) =>
  filter?.approvalSteps?.$not?.$elemMatch?.step?.$in ?? null;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Zanjir ko'rinishi — har rol o'z bosqichigacha yetgan yuklamani ko'radi", () => {
  test("O'UB (methodical, 1-bosqich): oldingi bosqich yo'q ⇒ ko'rinish filtri QO'YILMAYDI", async () => {
    const filter = await capturePaginateFilter(ROLES.OQUV_USLUBIY_BOSHQARMA);

    expect(priorStepsOf(filter)).toBeNull();
    expect(filter._id).toBeUndefined();
  });

  test("Kafedra mudiri: `methodical` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.KAFEDRA_MUDIRI, {
      department: "dddddddddddddddddddddddd",
    });

    expect(priorStepsOf(filter)).toEqual(["methodical"]);
    expect(filter.approvalSteps.$not.$elemMatch.status).toEqual({
      $ne: "approved",
    });
    expect(filter.department).toBe("dddddddddddddddddddddddd");
  });

  test("Reja-moliya: `methodical` + `kafedra` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.REJA_MOLIYA);
    expect(priorStepsOf(filter)).toEqual(["methodical", "kafedra"]);
  });

  test("Prorektor: undan oldingi 3 bosqich", async () => {
    const filter = await capturePaginateFilter(ROLES.PROREKTOR);
    expect(priorStepsOf(filter)).toEqual([
      "methodical",
      "kafedra",
      "financial",
    ]);
  });

  test("Rektor (oxirgi bosqich): undan oldingi 4 bosqich", async () => {
    const filter = await capturePaginateFilter(ROLES.REKTOR);
    expect(priorStepsOf(filter)).toEqual([
      "methodical",
      "kafedra",
      "financial",
      "prorektor",
    ]);
  });
});

describe("Zanjirda bosqichi YO'Q rol — hech narsa ko'rmaydi (fail-closed)", () => {
  const BLOCKED = { $eq: [1, 0] };

  test("Dekan: hech qachon rost bo'lmaydigan shart ⇒ natija bo'sh", async () => {
    const filter = await capturePaginateFilter(ROLES.DEKAN, {
      department: { $in: ["dddddddddddddddddddddddd"] },
    });

    expect(filter.$expr).toEqual(BLOCKED);
  });

  test("Rol nomi noma'lum bo'lsa ham fail-closed (yangi rol qo'shilsa avtomatik yopiq)", async () => {
    const filter = await capturePaginateFilter("kelgusi_yangi_rol");
    expect(filter.$expr).toEqual(BLOCKED);
  });

  test("Detail (`findOneWorkload`) ham yopiq — ID bilan ochib bo'lmaydi (IDOR)", async () => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    };
    WorkloadModel.findOne = jest.fn().mockReturnValue(chain);

    const req = createReq(ROLES.DEKAN);
    req.params.id = "cccccccccccccccccccccccc";
    const res = createRes();
    await Controller.findOneWorkload(req, res, jest.fn());

    const filter = WorkloadModel.findOne.mock.calls[0][0];
    expect(filter._id).toBe("cccccccccccccccccccccccc");
    expect(filter.$expr).toEqual(BLOCKED);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("PDF (`generatePdf`) ham yopiq — navbati kelmagan bosqich 404 oladi", async () => {
    WorkloadModel.exists = jest.fn().mockResolvedValue(null);

    const req = createReq(ROLES.DEKAN);
    req.params.id = "cccccccccccccccccccccccc";
    const res = createRes();
    await Controller.generatePdf(req, res, jest.fn());

    const filter = WorkloadModel.exists.mock.calls[0][0];
    expect(filter._id).toBe("cccccccccccccccccccccccc");
    expect(filter.$expr).toEqual(BLOCKED);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("Tizim rollari — bypass", () => {
  test("super_admin: ko'rinish filtri qo'yilmaydi", async () => {
    const filter = await capturePaginateFilter(ROLES.SUPER_ADMIN);
    expect(priorStepsOf(filter)).toBeNull();
    expect(filter._id).toBeUndefined();
  });

  test("moderator: ko'rinish filtri qo'yilmaydi", async () => {
    const filter = await capturePaginateFilter(ROLES.MODERATOR);
    expect(priorStepsOf(filter)).toBeNull();
    expect(filter._id).toBeUndefined();
  });
});

describe("MUTATSIYA QULFI — filtr olib tashlansa test qulashi kerak", () => {
  test("rad etilgan `kafedra` bosqichi keyingi rolga KO'RINMASLIGI filtr bilan ta'minlanadi", async () => {
    const filter = await capturePaginateFilter(ROLES.REJA_MOLIYA);
    const prior = priorStepsOf(filter);

    expect(prior).toContain("kafedra");
    expect(filter.approvalSteps.$not.$elemMatch.status.$ne).toBe("approved");
  });
});
