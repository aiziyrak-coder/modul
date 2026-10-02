const ScienceProgram = require("./scienceProgram.model");
const Controller = require("./scienceProgram.controller");
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
  const spy = jest
    .spyOn(ScienceProgram, "paginate")
    .mockResolvedValue({ docs: [] });
  const res = createRes();
  await Controller.paginateSciencePrograms(
    createReq(roleTitle, scope),
    res,
    jest.fn(),
  );
  expect(spy).toHaveBeenCalled();
  const filter = spy.mock.calls[0][0];
  spy.mockRestore();
  return filter;
};

const branchOf = (filter, variant) =>
  (filter.$or || []).find(
    (b) =>
      b.formVersion === variant ||
      (Array.isArray(b.formVersion?.$in) && b.formVersion.$in.includes(variant)),
  );

const priorStepsOfBranch = (branch) =>
  branch?.approvalSteps?.$not?.$elemMatch?.step?.$in ?? null;

const BLOCKED = { $eq: [1, 0] };

afterEach(() => jest.restoreAllMocks());

describe("scienceProgram — variant-aware ko'rinish (ADR-023, R-4.02-33)", () => {
  test("o'qituvchi (teacher, 1-bosqich, yaratuvchi): ikkala variantda ham cheklovsiz", async () => {
    const filter = await capturePaginateFilter(ROLES.OQITUVCHI);
    expect(priorStepsOfBranch(branchOf(filter, "v259"))).toBeNull();
    expect(priorStepsOfBranch(branchOf(filter, "v142"))).toBeNull();
  });

  test("kafedra mudiri: ikkala variantda ham faqat `teacher` tasdiqlangan bo'lishi shart", async () => {
    const filter = await capturePaginateFilter(ROLES.KAFEDRA_MUDIRI, {
      department: "dddddddddddddddddddddddd",
    });
    expect(priorStepsOfBranch(branchOf(filter, "v259"))).toEqual(["teacher"]);
    expect(priorStepsOfBranch(branchOf(filter, "v142"))).toEqual(["teacher"]);
    expect(filter.department).toBe("dddddddddddddddddddddddd");
  });

  test("ARM: v259 da bor (teacher+kafedra), v142 da FAIL-CLOSED (R-4.02-33)", async () => {
    const filter = await capturePaginateFilter(ROLES.ARM);
    expect(priorStepsOfBranch(branchOf(filter, "v259"))).toEqual([
      "teacher",
      "kafedra",
    ]);
    expect(branchOf(filter, "v142").$expr).toEqual(BLOCKED);
  });

  test("O'quv-uslubiy boshqarma (methodical): v259 da bor, v142 da FAIL-CLOSED", async () => {
    const filter = await capturePaginateFilter(ROLES.OQUV_USLUBIY_BOSHQARMA);
    expect(priorStepsOfBranch(branchOf(filter, "v259"))).toEqual([
      "teacher",
      "kafedra",
      "arm",
    ]);
    expect(branchOf(filter, "v142").$expr).toEqual(BLOCKED);
  });

  test.each([ROLES.PROREKTOR, ROLES.REKTOR])(
    "%s: kuzatuvchi — status filtri, variant shoxlari YO'Q (ADR-035 S1)",
    async (role) => {
      const filter = await capturePaginateFilter(role);
      const parts = [filter, ...(filter.$and || [])];
      expect(parts.some((f) => f.$or)).toBe(false);
      expect(
        parts.some(
          (f) =>
            f.status &&
            Array.isArray(f.status.$nin) &&
            f.status.$nin.includes("draft") &&
            f.status.$nin.includes("rejected"),
        ),
      ).toBe(true);
    },
  );

  test("Dekan: v142 da (teacher+kafedra), v259 «B1»da (…+arm+methodical) — ADR-035", async () => {
    const filter = await capturePaginateFilter(ROLES.DEKAN, {
      department: { $in: ["dddddddddddddddddddddddd"] },
    });
    expect(priorStepsOfBranch(branchOf(filter, "v142"))).toEqual([
      "teacher",
      "kafedra",
    ]);
    expect(priorStepsOfBranch(branchOf(filter, "v259"))).toEqual([
      "teacher",
      "kafedra",
      "arm",
      "methodical",
    ]);
    expect(branchOf(filter, "v259").$expr).toBeUndefined();
    expect(filter.department).toEqual({ $in: ["dddddddddddddddddddddddd"] });
  });
});

describe("P1-4 — v259 shoxi `formVersion` yo'q/`null` hujjatni ham qamraydi", () => {
  test("kafedra mudiri: v259 selektori aniq tenglik EMAS, `$in: [\"v259\", null]`", async () => {
    const filter = await capturePaginateFilter(ROLES.KAFEDRA_MUDIRI, {
      department: "dddddddddddddddddddddddd",
    });
    const v259Raw = filter.$or.find((b) =>
      Array.isArray(b.formVersion?.$in),
    );
    expect(v259Raw.formVersion).toEqual({ $in: ["v259", null] });
  });

  test("v142 selektori o'zgarmadi — aniq tenglik (backfill qoidasi tegishli emas)", async () => {
    const filter = await capturePaginateFilter(ROLES.KAFEDRA_MUDIRI, {
      department: "dddddddddddddddddddddddd",
    });
    const v142Raw = filter.$or.find((b) => b.formVersion === "v142");
    expect(v142Raw).toBeDefined();
  });
});

describe("Zanjirda umuman bosqichi YO'Q rol — ikkala shox ham fail-closed", () => {
  test("Rol nomi noma'lum bo'lsa ham fail-closed (yangi rol qo'shilsa avtomatik yopiq)", async () => {
    const filter = await capturePaginateFilter("kelgusi_yangi_rol");
    expect(branchOf(filter, "v259").$expr).toEqual(BLOCKED);
    expect(branchOf(filter, "v142").$expr).toEqual(BLOCKED);
  });
});

describe("Tizim rollari — bypass", () => {
  test("super_admin: ko'rinish filtri qo'yilmaydi ($or yo'q)", async () => {
    const filter = await capturePaginateFilter(ROLES.SUPER_ADMIN);
    expect(filter.$or).toBeUndefined();
  });

  test("moderator: ko'rinish filtri qo'yilmaydi", async () => {
    const filter = await capturePaginateFilter(ROLES.MODERATOR);
    expect(filter.$or).toBeUndefined();
  });
});

describe("Detail (`findOneScienceProgram`) — IDOR: navbati kelmagan bosqich 404 oladi", () => {
  const chainQuery = (resolvedDoc) => {
    const q = {};
    q.populate = jest.fn().mockReturnValue(q);
    q.exec = jest.fn().mockResolvedValue(resolvedDoc);
    return q;
  };

  test("ARM + v142 hujjat ID: filtrga $or v142 shoxi fail-closed tushadi, 404", async () => {
    const spy = jest
      .spyOn(ScienceProgram, "findOne")
      .mockReturnValue(chainQuery(null));
    const req = createReq(ROLES.ARM);
    req.params.id = "6a995da8560c63b8df917e4f";
    const res = createRes();

    await Controller.findOneScienceProgram(req, res, jest.fn());

    const filter = spy.mock.calls[0][0];
    expect(filter._id).toBe("6a995da8560c63b8df917e4f");
    expect(branchOf(filter, "v142").$expr).toEqual(BLOCKED);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("Dekan + v259 hujjat ID: v259 shoxi oldingi 4 bosqich approved bo'lishini talab qiladi, topilmasa 404", async () => {
    const spy = jest
      .spyOn(ScienceProgram, "findOne")
      .mockReturnValue(chainQuery(null));
    const req = createReq(ROLES.DEKAN);
    req.params.id = "6a981782d62556d447843c60";
    const res = createRes();

    await Controller.findOneScienceProgram(req, res, jest.fn());

    const filter = spy.mock.calls[0][0];
    expect(filter._id).toBe("6a981782d62556d447843c60");
    expect(priorStepsOfBranch(branchOf(filter, "v259"))).toEqual([
      "teacher",
      "kafedra",
      "arm",
      "methodical",
    ]);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test.each([
    ["findOneScienceProgramTopic"],
    ["findOneScienceProgramIndependentTask"],
    ["findOneScienceProgramSeminarRecommendation"],
  ])("%s: ARM + v142 hujjat ID — fail-closed, 404", async (handlerName) => {
    const spy = jest
      .spyOn(ScienceProgram, "findOne")
      .mockReturnValue(Promise.resolve(null));
    const req = createReq(ROLES.ARM);
    req.params.id = "6a995da8560c63b8df917e4f";
    const res = createRes();

    await Controller[handlerName](req, res, jest.fn());

    const filter = spy.mock.calls[0][0];
    expect(filter._id).toBe("6a995da8560c63b8df917e4f");
    expect(branchOf(filter, "v142").$expr).toEqual(BLOCKED);
    expect(res.status).toHaveBeenCalledWith(404);
    spy.mockRestore();
  });
});
