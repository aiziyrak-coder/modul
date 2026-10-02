const Syllabus = require("./syllabus.model");
const Controller = require("./syllabus.controller");
const { ROLES } = require("#config/constants");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (roleTitle, scope = {}) => ({
  query: { page: "1", limit: "10" },
  params: {},
  body: {},
  scope,
  user: { _id: "507f1f77bcf86cd799439011", role: { title: roleTitle } },
});

const capturePaginateFilter = async (roleTitle, scope = {}) => {
  const spy = jest.spyOn(Syllabus, "paginate").mockResolvedValue({ docs: [] });
  const res = createRes();
  await Controller.paginateSyllabuses(
    createReq(roleTitle, scope),
    res,
    jest.fn(),
  );
  expect(spy).toHaveBeenCalled();
  const filter = spy.mock.calls[0][0];
  spy.mockRestore();
  return filter;
};

const priorStepsOf = (filter) =>
  filter?.approvalSteps?.$not?.$elemMatch?.step?.$in ?? null;

const BLOCKED = { $eq: [1, 0] };

afterEach(() => jest.restoreAllMocks());

describe("syllabus — har rol o'z bosqichigacha yetgan hujjatni ko'radi", () => {
  test("kafedra mudiri (1-bosqich): oldingi bosqich yo'q ⇒ ko'rinish filtri QO'YILMAYDI", async () => {
    const filter = await capturePaginateFilter(ROLES.KAFEDRA_MUDIRI, {
      "author.teacher": { $in: ["dddddddddddddddddddddddd"] },
    });
    expect(priorStepsOf(filter)).toBeNull();
    expect(filter._id).toBeUndefined();
  });

  test("ARM: `kafedra` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.ARM);
    expect(priorStepsOf(filter)).toEqual(["kafedra"]);
  });

  test("O'quv-uslubiy boshqarma (methodical): `kafedra` + `arm` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.OQUV_USLUBIY_BOSHQARMA);
    expect(priorStepsOf(filter)).toEqual(["kafedra", "arm"]);
  });

  test("Dekan: undan oldingi 3 bosqich", async () => {
    const filter = await capturePaginateFilter(ROLES.DEKAN, {
      faculty: "ffffffffffffffffffffffff",
    });
    expect(priorStepsOf(filter)).toEqual(["kafedra", "arm", "methodical"]);
    expect(filter.faculty).toBe("ffffffffffffffffffffffff");
  });

  test("Prorektor (oxirgi bosqich): undan oldingi 4 bosqich", async () => {
    const filter = await capturePaginateFilter(ROLES.PROREKTOR);
    expect(priorStepsOf(filter)).toEqual([
      "kafedra",
      "arm",
      "methodical",
      "dean",
    ]);
  });
});

describe("Kuzatuvchi (observerRoles) — rektor, zanjir bosqichi yo'q (R-4.02-35)", () => {
  test("rektor: draft/new/rejected KO'RMAYDI, approvalSteps kaliti YO'Q", async () => {
    const filter = await capturePaginateFilter(ROLES.REKTOR);
    expect(filter.$and).toBeDefined();
    const statusConditions = filter.$and.map((f) => f.status).filter(Boolean);
    expect(statusConditions).toContainEqual({ $nin: ["draft", "new"] });
    expect(statusConditions).toContainEqual({
      $nin: ["draft", "new", "rejected"],
    });
    expect(filter.approvalSteps).toBeUndefined();
    expect(filter.$expr).toBeUndefined();
  });
});

describe("P1-5 — `?status=` va chain-cheklov $and bilan birga saqlanadi", () => {
  test("rektor (kuzatuvchi) + ?status=rejected — ikkala shart $and ichida, hech biri yo'qolmaydi", async () => {
    const spy = jest.spyOn(Syllabus, "paginate").mockResolvedValue({ docs: [] });
    const req = createReq(ROLES.REKTOR);
    req.query.status = "rejected";
    const res = createRes();
    await Controller.paginateSyllabuses(req, res, jest.fn());
    const filter = spy.mock.calls[0][0];
    spy.mockRestore();

    expect(Array.isArray(filter.$and)).toBe(true);
    const statuses = filter.$and.map((f) => f.status).filter(Boolean);
    expect(statuses).toContainEqual("rejected");
    expect(statuses).toContainEqual({ $nin: ["draft", "new", "rejected"] });
  });
});

describe("Ega (ownerRoles) — oqituvchi, P0-1 (avval FAIL_CLOSED edi)", () => {
  const OWNER_ID = "507f1f77bcf86cd799439011";

  test("paginate: department-scope (drift) bilan ANDlanadi — faqat O'Z hujjati, FAIL_CLOSED emas", async () => {
    const memberIds = ["dddddddddddddddddddddddd", OWNER_ID];
    const filter = await capturePaginateFilter(ROLES.OQITUVCHI, {
      "author.teacher": { $in: memberIds },
    });

    expect(filter.$expr).toBeUndefined();
    expect(Array.isArray(filter.$and)).toBe(true);
    expect(filter.$and).toContainEqual({ "author.teacher": OWNER_ID });
  });

  test("paginate: self-scope (canonik) bilan ham FAIL_CLOSED emas", async () => {
    const filter = await capturePaginateFilter(ROLES.OQITUVCHI, {
      "author.teacher": OWNER_ID,
    });
    expect(filter.$expr).toBeUndefined();
  });

  test("detail (findOneSyllabus): muallif o'z hujjatini ko'radi — 404 emas", async () => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: "cccccccccccccccccccccccc" }),
    };
    const spy = jest.spyOn(Syllabus, "findOne").mockReturnValue(chain);

    const req = createReq(ROLES.OQITUVCHI, { "author.teacher": OWNER_ID });
    req.params.id = "cccccccccccccccccccccccc";
    const res = createRes();
    await Controller.findOneSyllabus(req, res, jest.fn());

    const filter = spy.mock.calls[0][0];
    expect(filter._id).toBe("cccccccccccccccccccccccc");
    expect(filter.$expr).toBeUndefined();
    expect(res.status).not.toHaveBeenCalledWith(404);
    spy.mockRestore();
  });
});

describe("Zanjirda bosqichi YO'Q rol — hech narsa ko'rmaydi (fail-closed)", () => {
  test("Rol nomi noma'lum bo'lsa ham fail-closed", async () => {
    const filter = await capturePaginateFilter("kelgusi_yangi_rol");
    expect(filter.$expr).toEqual(BLOCKED);
  });

  test("Detail (`findOneSyllabus`) ham yopiq — ID bilan ochib bo'lmaydi (IDOR)", async () => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    };
    const spy = jest.spyOn(Syllabus, "findOne").mockReturnValue(chain);

    const req = createReq("kelgusi_yangi_rol");
    req.params.id = "cccccccccccccccccccccccc";
    const res = createRes();
    await Controller.findOneSyllabus(req, res, jest.fn());

    const filter = spy.mock.calls[0][0];
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
  });
});

describe("MUTATSIYA QULFI — filtr olib tashlansa test qulashi kerak", () => {
  test("rad etilgan `arm` bosqichi keyingi rolga KO'RINMASLIGI filtr bilan ta'minlanadi", async () => {
    const filter = await capturePaginateFilter(ROLES.OQUV_USLUBIY_BOSHQARMA);
    const prior = priorStepsOf(filter);
    expect(prior).toContain("arm");
    expect(filter.approvalSteps.$not.$elemMatch.status.$ne).toBe("approved");
  });
});
