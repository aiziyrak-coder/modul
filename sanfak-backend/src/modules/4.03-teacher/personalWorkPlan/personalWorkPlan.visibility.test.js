jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");
const { ROLES } = require("#config/constants");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createChain = (resolved = []) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolved);
  return chain;
};

const createReq = (roleTitle, scope = {}, extra = {}) => ({
  query: {},
  params: {},
  body: {},
  scope,
  user: roleTitle
    ? { _id: "507f1f77bcf86cd799439011", role: { title: roleTitle } }
    : undefined,
  ...extra,
});

const priorStepsOf = (filter) =>
  filter?.approvals?.$not?.$elemMatch?.step?.$in ?? null;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("findAllWorkPlans — GURUHLI ko'rinish filtri (ADR-023 Qaror #6)", () => {
  const capture = async (roleTitle, scope = {}) => {
    const chain = createChain([]);
    PersonalWorkPlanModel.find = jest.fn().mockReturnValue(chain);
    await Controller.findAllWorkPlans(createReq(roleTitle, scope), createRes(), jest.fn());
    expect(PersonalWorkPlanModel.find).toHaveBeenCalled();
    return PersonalWorkPlanModel.find.mock.calls[0][0];
  };

  test("oqituvchi (G0, self scope) — cheklov qo'shilmaydi (scope o'zi cheklaydi)", async () => {
    const filter = await capture(ROLES.OQITUVCHI, { teacher: "me-id" });
    expect(priorStepsOf(filter)).toBeNull();
    expect(filter.teacher).toBe("me-id");
  });

  test("kafedra_uslubiy_masul (G1) — faqat `teacher` (G0) oldin bo'lishi kerak", async () => {
    const filter = await capture(ROLES.KAFEDRA_USLUBIY_MASUL, {
      teacher: { $in: ["a", "b"] },
    });
    expect(priorStepsOf(filter)).toEqual(["teacher"]);
    expect(filter.teacher).toEqual({ $in: ["a", "b"] });
  });

  test("kafedra_mudiri (G2) — G0+G1 (4 ta step) oldin bo'lishi kerak", async () => {
    const filter = await capture(ROLES.KAFEDRA_MUDIRI, { teacher: { $in: ["a"] } });
    expect(priorStepsOf(filter)).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
    ]);
  });

  test("ichki_nazorat (G5) — 7 ta oldingi step", async () => {
    const filter = await capture(ROLES.ICHKI_NAZORAT, {});
    expect(priorStepsOf(filter)).toHaveLength(7);
  });

  test("zanjirda BOSQICHI yo'q rol (kadrlar) — FAIL-CLOSED (`$expr`)", async () => {
    const filter = await capture(ROLES.KADRLAR, {});
    expect(filter.$expr).toEqual({ $eq: [1, 0] });
  });

  test("super_admin/moderator — bypass, cheklov qo'shilmaydi", async () => {
    const filterAdmin = await capture(ROLES.SUPER_ADMIN, {});
    expect(priorStepsOf(filterAdmin)).toBeNull();
    expect(filterAdmin.$expr).toBeUndefined();

    const filterMod = await capture(ROLES.MODERATOR, {});
    expect(priorStepsOf(filterMod)).toBeNull();
  });

  test("`req.user` yo'q (mudofaa: middleware tartibsizligi) — fail-closed, lekin YIQILMAYDI", async () => {
    const chain = createChain([]);
    PersonalWorkPlanModel.find = jest.fn().mockReturnValue(chain);
    const req = createReq(null, {});
    delete req.user;

    await expect(
      Controller.findAllWorkPlans(req, createRes(), jest.fn()),
    ).resolves.not.toThrow();
    const filter = PersonalWorkPlanModel.find.mock.calls[0][0];
    expect(filter.$expr).toEqual({ $eq: [1, 0] });
  });

  test("`active`/`academicYear`/`status` query filtri hamon qo'llanadi (regressiya)", async () => {
    const chain = createChain([]);
    PersonalWorkPlanModel.find = jest.fn().mockReturnValue(chain);
    const req = createReq(ROLES.OQITUVCHI, { teacher: "me-id" });
    req.query = { academicYear: "ay-1", status: "submitted" };

    await Controller.findAllWorkPlans(req, createRes(), jest.fn());

    const filter = PersonalWorkPlanModel.find.mock.calls[0][0];
    expect(filter.academicYear).toBe("ay-1");
    expect(filter.status).toBe("submitted");
    expect(filter.active).toBe(true);
  });
});

describe("paginateWorkPlans — GURUHLI ko'rinish filtri", () => {
  test("kafedra_mudiri (G2) — bir xil priorSteps, `active:true` saqlanadi", async () => {
    PersonalWorkPlanModel.paginate = jest.fn().mockResolvedValue({ docs: [], totalDocs: 0 });
    await Controller.paginateWorkPlans(
      createReq(ROLES.KAFEDRA_MUDIRI, { teacher: { $in: ["a"] } }),
      createRes(),
      jest.fn(),
    );

    const filter = PersonalWorkPlanModel.paginate.mock.calls[0][0];
    expect(priorStepsOf(filter)).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
    ]);
    expect(filter.active).toBe(true);
  });
});

describe("findOneWorkPlan — GURUHLI ko'rinish (detal, 404 — sabab kodi yo'q)", () => {
  test("kafedra_mudiri (G2) — filtrga `approvals` cheklovi qo'shiladi (`_id` va `scope` saqlanadi)", async () => {
    const chain = createChain(null);
    PersonalWorkPlanModel.findOne = jest.fn().mockReturnValue(chain);
    const req = createReq(ROLES.KAFEDRA_MUDIRI, { teacher: { $in: ["a"] } });
    req.params = { id: "plan-id-1" };
    const res = createRes();

    await Controller.findOneWorkPlan(req, res, jest.fn());

    const filter = PersonalWorkPlanModel.findOne.mock.calls[0][0];
    expect(filter._id).toBe("plan-id-1");
    expect(filter.teacher).toEqual({ $in: ["a"] });
    expect(priorStepsOf(filter)).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
    ]);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Topilmadi" });
  });

  test("oqituvchi (G0) — filtr cheklovsiz, faqat `_id` + scope", async () => {
    const chain = createChain({ _id: "plan-id-1" });
    PersonalWorkPlanModel.findOne = jest.fn().mockReturnValue(chain);
    const req = createReq(ROLES.OQITUVCHI, { teacher: "me-id" });
    req.params = { id: "plan-id-1" };

    await Controller.findOneWorkPlan(req, createRes(), jest.fn());

    const filter = PersonalWorkPlanModel.findOne.mock.calls[0][0];
    expect(filter).toEqual({ _id: "plan-id-1", teacher: "me-id" });
  });
});
