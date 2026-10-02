jest.mock("./user.model");
jest.mock("#modules/4.01-auth/role/role.model");

const { createMockReq, createMockRes, createMockNext } = require("../../../../test/helpers/mockResponse");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const permit = require("#shared/permission");
const UserModel = require("./user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const Controller = require("./user.controller");
const { lookupSchema } = require("./user.validation");

const mockFindChain = (resolvedDocs) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedDocs),
  };
  UserModel.find = jest.fn().mockReturnValue(chain);
  return chain;
};

const mockRoleFindChain = (resolvedDocs) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resolvedDocs),
  };
  RoleModel.find = jest.fn().mockReturnValue(chain);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("user.validation — lookupSchema role", () => {
  test("role berilmasa o'tadi (orqaga moslik)", () => {
    expect(lookupSchema.validate({}).error).toBeUndefined();
  });

  test("role bitta ObjectId string sifatida o'tadi", () => {
    expect(lookupSchema.validate({ role: "64a1f0000000000000000001" }).error).toBeUndefined();
  });

  test("role bitta nom string sifatida o'tadi", () => {
    expect(lookupSchema.validate({ role: "talaba" }).error).toBeUndefined();
  });

  test("role vergul bilan ajratilgan satr sifatida o'tadi (?role=talaba,rezident)", () => {
    expect(lookupSchema.validate({ role: "talaba,rezident" }).error).toBeUndefined();
  });

  test("role massiv sifatida o'tadi (?role=a&role=b)", () => {
    expect(lookupSchema.validate({ role: ["talaba", "rezident"] }).error).toBeUndefined();
  });

  test("bo'sh massiv rad etiladi", () => {
    expect(lookupSchema.validate({ role: [] }).error).toBeDefined();
  });
});

describe("GET /users/lookup — RBAC gate", () => {
  const run = async (req) => {
    const next = createMockNext();
    await permit(MODULES.USER, [ACTIONS.SEARCH])(req, {}, next);
    return next.mock.calls[0]?.[0];
  };

  test("faqat user:search bilan rol -> o'tadi (403 yo'q)", async () => {
    const req = createMockReq({
      user: {
        role: {
          title: "amaliyot_bolimi",
          permissions: [{ section: MODULES.USER, actionKeys: [ACTIONS.SEARCH] }],
        },
      },
    });
    const err = await run(req);
    expect(err).toBeUndefined();
  });

  test("user:readAll bor, lekin user:search yo'q -> 403 (D-054 kontrakti: readAll bilan lookup ochilmaydi)", async () => {
    const req = createMockReq({
      user: {
        role: {
          title: "talaba",
          permissions: [{ section: MODULES.USER, actionKeys: [ACTIONS.READ_ALL] }],
        },
      },
    });
    const err = await run(req);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("user section umuman yo'q -> 403", async () => {
    const req = createMockReq({
      user: { role: { title: "talaba", permissions: [] } },
    });
    const err = await run(req);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("super_admin bypass qiladi", async () => {
    const req = createMockReq({
      user: { role: { title: ROLES.SUPER_ADMIN, permissions: [] } },
    });
    const err = await run(req);
    expect(err).toBeUndefined();
  });
});

describe("user.controller.lookup — projeksiya va limit", () => {
  const SAFE_DOC = {
    _id: "u1",
    firstName: "Ali",
    lastName: "Valiyev",
    position: { _id: "p1", title: "Dotsent" },
    role: { _id: "r1", title: "oqituvchi" },
    department: { _id: "d1", title: "Terapiya kafedrasi" },
    academicTitle: { _id: "a1", title: "Dotsent" },
  };

  test("javobda faqat _id/firstName/lastName/position/role/department/academicTitle — oneIdPin/refreshToken/passportNumber yo'q", async () => {
    const chain = mockFindChain([SAFE_DOC]);
    const req = createMockReq({ query: {} });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual([SAFE_DOC]);
    payload.forEach((doc) => {
      expect(doc).not.toHaveProperty("oneIdPin");
      expect(doc).not.toHaveProperty("refreshToken");
      expect(doc).not.toHaveProperty("passportNumber");
      expect(Object.keys(doc).sort()).toEqual(
        ["_id", "firstName", "lastName", "position", "role", "department", "academicTitle"].sort(),
      );
    });
    expect(UserModel.find).toHaveBeenCalledWith({ active: true });
    expect(chain.select).toHaveBeenCalledWith(
      "_id firstName lastName position role department academicTitle",
    );
    expect(RoleModel.find).not.toHaveBeenCalled();
  });

  test("?search= bilan $or filtr (firstName/lastName, regex-escaped)", async () => {
    mockFindChain([]);
    const req = createMockReq({ query: { search: "Ali" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    const [filter] = UserModel.find.mock.calls[0];
    expect(filter.active).toBe(true);
    expect(filter.$or).toEqual([
      { firstName: expect.any(RegExp) },
      { lastName: expect.any(RegExp) },
    ]);
  });

  test("search bo'sh bo'lsa ham ishlaydi ($or qo'yilmaydi)", async () => {
    mockFindChain([]);
    const req = createMockReq({ query: {} });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    const [filter] = UserModel.find.mock.calls[0];
    expect(filter.$or).toBeUndefined();
  });

  test("?role=<ObjectId> -> role.$in shu id bilan, Role modeliga so'rov yo'q", async () => {
    const chain = mockFindChain([]);
    const req = createMockReq({ query: { role: "64a1f0000000000000000001" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    const [filter] = UserModel.find.mock.calls[0];
    expect(filter.role).toEqual({ $in: ["64a1f0000000000000000001"] });
    expect(RoleModel.find).not.toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalled();
  });

  test("?role=talaba,rezident (nom, vergul bilan) -> Role'dan _id rezolyutsiya qilinadi, $in ikkalasi bilan", async () => {
    mockRoleFindChain([
      { _id: "r-talaba" },
      { _id: "r-rezident" },
    ]);
    mockFindChain([]);
    const req = createMockReq({ query: { role: "talaba,rezident" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    expect(RoleModel.find).toHaveBeenCalledWith({ title: { $in: ["talaba", "rezident"] } });
    const [filter] = UserModel.find.mock.calls[0];
    expect(filter.role).toEqual({ $in: ["r-talaba", "r-rezident"] });
  });

  test("?role= massiv (id + nom aralash) -> ikkalasi birlashadi", async () => {
    mockRoleFindChain([{ _id: "r-talaba" }]);
    mockFindChain([]);
    const req = createMockReq({
      query: { role: ["64a1f0000000000000000001", "talaba"] },
    });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    expect(RoleModel.find).toHaveBeenCalledWith({ title: { $in: ["talaba"] } });
    const [filter] = UserModel.find.mock.calls[0];
    expect(filter.role.$in.sort()).toEqual(["64a1f0000000000000000001", "r-talaba"].sort());
  });

  test("?role=nomavjud (topilmagan nom) -> bo'sh $in, hech kim qaytmaydi (filtr chetlab o'tilmaydi)", async () => {
    mockRoleFindChain([]);
    mockFindChain([]);
    const req = createMockReq({ query: { role: "nomavjud_rol" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    const [filter] = UserModel.find.mock.calls[0];
    expect(filter.role).toEqual({ $in: [] });
  });

  test("limit=100000 -> server 100 bilan cheklaydi (klient qiymati e'tiborsiz)", async () => {
    const chain = mockFindChain([]);
    const req = createMockReq({ query: { limit: "100000" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  test("limit berilmasa -> default 50", async () => {
    const chain = mockFindChain([]);
    const req = createMockReq({ query: {} });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.lookup(req, res, next);

    expect(chain.limit).toHaveBeenCalledWith(50);
  });
});
