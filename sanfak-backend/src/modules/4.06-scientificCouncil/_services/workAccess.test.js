jest.mock("#modules/4.06-scientificCouncil/scientificWork/scientificWork.model");

const ScientificWork = require("#modules/4.06-scientificCouncil/scientificWork/scientificWork.model");
const {
  canReadWork,
  canWriteWork,
  requireWorkReadAccess,
  requireWorkReadAccessFromBody,
} = require("./workAccess");

const RESEARCHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SECRETARY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const MEMBER_ID = "cccccccccccccccccccccccc";
const STRANGER_ID = "dddddddddddddddddddddddd";
const WORK_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const baseWork = (overrides = {}) => ({
  _id: WORK_ID,
  researcher: RESEARCHER_ID,
  secretary: SECRETARY_ID,
  councilMembers: [MEMBER_ID],
  ...overrides,
});

const userWith = (id, scopeLevel = "self") => ({ _id: id, role: { scopeLevel } });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workAccess — canReadWork matritsasi", () => {
  test("global scope foydalanuvchi (masalan kotib) — true", () => {
    expect(canReadWork(baseWork(), userWith(STRANGER_ID, "global"))).toBe(true);
  });

  test("muallif (researcher) — true", () => {
    expect(canReadWork(baseWork(), userWith(RESEARCHER_ID))).toBe(true);
  });

  test("kotib (secretary) o'zi — true", () => {
    expect(canReadWork(baseWork(), userWith(SECRETARY_ID))).toBe(true);
  });

  test("biriktirilgan kengash a'zosi (councilMembers) — true", () => {
    expect(canReadWork(baseWork(), userWith(MEMBER_ID))).toBe(true);
  });

  test("begona foydalanuvchi — false", () => {
    expect(canReadWork(baseWork(), userWith(STRANGER_ID))).toBe(false);
  });

  test("populate qilingan researcher (obyekt, _id bilan) — to'g'ri ishlaydi", () => {
    const work = baseWork({ researcher: { _id: RESEARCHER_ID, firstName: "Ali" } });
    expect(canReadWork(work, userWith(RESEARCHER_ID))).toBe(true);
  });
});

describe("workAccess — canWriteWork matritsasi", () => {
  test("global scope foydalanuvchi — true", () => {
    expect(canWriteWork(baseWork(), userWith(STRANGER_ID, "global"))).toBe(true);
  });

  test("muallif (researcher) — true", () => {
    expect(canWriteWork(baseWork(), userWith(RESEARCHER_ID))).toBe(true);
  });

  test("kotib (secretary) o'zi — true", () => {
    expect(canWriteWork(baseWork(), userWith(SECRETARY_ID))).toBe(true);
  });

  test("biriktirilgan kengash a'zosi — false (faqat ko'radi, tahrirlay olmaydi)", () => {
    expect(canWriteWork(baseWork(), userWith(MEMBER_ID))).toBe(false);
  });

  test("begona foydalanuvchi — false", () => {
    expect(canWriteWork(baseWork(), userWith(STRANGER_ID))).toBe(false);
  });
});

const createMockReq = (overrides = {}) => ({
  params: { workId: WORK_ID },
  user: userWith(STRANGER_ID),
  ...overrides,
});

const createMockNext = () => jest.fn();

const mockFindById = (doc) => {
  ScientificWork.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(doc),
  });
};

const run = async (guard, req) => {
  const next = createMockNext();
  await guard(req, {}, next);
  return next.mock.calls[0]?.[0];
};

describe("workAccess — requireWorkReadAccess(paramName)", () => {
  const guard = requireWorkReadAccess("workId");

  test("ruxsat bor foydalanuvchi (biriktirilgan a'zo) — o'tadi, req.work o'rnatiladi", async () => {
    mockFindById(baseWork());
    const req = createMockReq({ user: userWith(MEMBER_ID) });

    const err = await run(guard, req);

    expect(err).toBeUndefined();
    expect(req.work).toEqual(baseWork());
    expect(ScientificWork.findById).toHaveBeenCalledWith(WORK_ID);
  });

  test("begona foydalanuvchi — 403", async () => {
    mockFindById(baseWork());
    const req = createMockReq({ user: userWith(STRANGER_ID) });

    const err = await run(guard, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("ish topilmasa — 404", async () => {
    mockFindById(null);
    const req = createMockReq();

    const err = await run(guard, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
  });

  test("paramName parametrlashtirilgan — masalan 'id' bilan ham ishlaydi", async () => {
    mockFindById(baseWork());
    const idGuard = requireWorkReadAccess("id");
    const req = { params: { id: WORK_ID }, user: userWith(RESEARCHER_ID) };

    const err = await run(idGuard, req);

    expect(err).toBeUndefined();
    expect(ScientificWork.findById).toHaveBeenCalledWith(WORK_ID);
  });

  test("req.user yo'q -> 500 (authenticate avval chaqirilmagan)", async () => {
    const req = { params: { workId: WORK_ID }, user: undefined };

    const err = await run(guard, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
    expect(ScientificWork.findById).not.toHaveBeenCalled();
  });
});

describe("workAccess — requireWorkReadAccessFromBody(field)", () => {
  const guard = requireWorkReadAccessFromBody("work");

  test("biriktirilgan a'zo o'z ishiga — o'tadi", async () => {
    mockFindById(baseWork());
    const req = { body: { work: WORK_ID }, user: userWith(MEMBER_ID) };

    const err = await run(guard, req);

    expect(err).toBeUndefined();
    expect(ScientificWork.findById).toHaveBeenCalledWith(WORK_ID);
  });

  test("IDOR: begona ish id'si body'da — 403", async () => {
    mockFindById(baseWork());
    const req = { body: { work: WORK_ID }, user: userWith(STRANGER_ID) };

    const err = await run(guard, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("ish topilmasa — 404", async () => {
    mockFindById(null);
    const req = { body: { work: WORK_ID }, user: userWith(MEMBER_ID) };

    const err = await run(guard, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
  });

  test("body/param'da id yo'q — DB'ga BORMASDAN 400", async () => {
    mockFindById(null);
    const req = { user: userWith(MEMBER_ID) };

    const err = await run(guard, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(ScientificWork.findById).not.toHaveBeenCalled();
  });

  test("bo'sh string id — ham 400", async () => {
    mockFindById(null);
    const req = { body: { work: "" }, user: userWith(MEMBER_ID) };

    const err = await run(guard, req);

    expect(err.statusCode).toBe(400);
    expect(ScientificWork.findById).not.toHaveBeenCalled();
  });
});
