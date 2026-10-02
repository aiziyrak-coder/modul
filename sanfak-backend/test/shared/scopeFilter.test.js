const scopeFilter = require("#shared/scopeFilter");
const { createMockReq, createMockNext } = require("../helpers/mockResponse");

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";
const DEP = "6a99de9982b198d4acbe2555";

const run = async (middleware, req) => {
  const next = createMockNext();
  await middleware(req, {}, next);
  return { err: next.mock.calls[0]?.[0], req };
};

const dekan = (overrides = {}) => ({
  _id: "u-dekan",
  role: { title: "dekan", scopeLevel: "faculty" },
  ...overrides,
});

describe("scopeFilter — case 'faculty' (dekan, kotib) · ADR-030", () => {
  test("(a) faqat users.faculty, kafedrasiz → req.scope = { faculty: users.faculty }", async () => {
    const req = createMockReq({ user: dekan({ faculty: F_OWN, department: null }) });
    const { err } = await run(scopeFilter("faculty"), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({ faculty: F_OWN });
  });

  test("(b) faqat department.faculty → zaxira (avvalgi xulq saqlanadi)", async () => {
    const req = createMockReq({ user: dekan({ department: { _id: DEP, faculty: F_DEP } }) });
    const { err } = await run(scopeFilter("faculty"), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({ faculty: F_DEP });
  });

  test("(c) ikkalasi farqli (Rasulova) → users.faculty g'olib", async () => {
    const req = createMockReq({
      user: dekan({ faculty: F_OWN, department: { _id: DEP, faculty: F_DEP } }),
    });
    const { err } = await run(scopeFilter("department"), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({ faculty: F_OWN });
  });

  test("ikkalasi ham yo'q → 403 (fail-closed, doira ochilmaydi)", async () => {
    const req = createMockReq({ user: dekan({ faculty: null, department: null }) });
    const { err } = await run(scopeFilter("faculty"), req);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
    expect(req.scope).toBeUndefined();
  });

  test("scopeField 'user' → faculty-scoped ham faqat o'zini ko'radi (o'zgarmagan)", async () => {
    const req = createMockReq({ user: dekan({ faculty: F_OWN }) });
    const { err } = await run(scopeFilter("user"), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({ user: "u-dekan" });
  });
});

describe("scopeFilter — case 'department' + scopeField 'faculty' (kafedra-langar, ADR-030 da TEGILMAGAN)", () => {
  test("ikkalasi farqli → FAQAT department.faculty (users.faculty e'tiborsiz)", async () => {
    const req = createMockReq({
      user: {
        _id: "u-mudir",
        role: { title: "kafedra_mudiri", scopeLevel: "department" },
        faculty: F_OWN,
        department: { _id: DEP, faculty: F_DEP },
      },
    });
    const { err } = await run(scopeFilter("faculty"), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({ faculty: F_DEP });
  });

  test("department.faculty yo'q, users.faculty bor → 403 (kesh haqiqat emas)", async () => {
    const req = createMockReq({
      user: {
        _id: "u-mudir",
        role: { title: "kafedra_mudiri", scopeLevel: "department" },
        faculty: F_OWN,
        department: { _id: DEP, faculty: null },
      },
    });
    const { err } = await run(scopeFilter("faculty"), req);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("scopeField 'department' → { department } (o'zgarmagan)", async () => {
    const req = createMockReq({
      user: {
        _id: "u-mudir",
        role: { title: "kafedra_mudiri", scopeLevel: "department" },
        department: { _id: DEP, faculty: F_DEP },
      },
    });
    const { err } = await run(scopeFilter("department"), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({ department: DEP });
  });
});

describe("scopeFilter — boshqa shoxlar (regressiya qopqoni)", () => {
  test("global → {}", async () => {
    const req = createMockReq({ user: { _id: "u", role: { title: "admin", scopeLevel: "global" } } });
    const { err } = await run(scopeFilter("faculty"), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({});
  });

  test("self → { user }", async () => {
    const req = createMockReq({ user: { _id: "u-self", role: { title: "talaba", scopeLevel: "self" }, faculty: F_OWN } });
    const { err } = await run(scopeFilter("faculty"), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({ user: "u-self" });
  });

  test("bypassRoles → {} (scopeLevel'dan qat'i nazar)", async () => {
    const req = createMockReq({ user: { _id: "u", role: { title: "kadrlar", scopeLevel: "department" } } });
    const { err } = await run(scopeFilter("department", { bypassRoles: ["kadrlar"] }), req);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({});
  });

  test("rol yo'q → 403", async () => {
    const req = createMockReq({ user: { _id: "u" } });
    const { err } = await run(scopeFilter("faculty"), req);
    expect(err.statusCode).toBe(403);
  });
});
