const { scopeForRole, GLOBAL_ROLES, articleScope } = require("./article.scope");
const { ROLES } = require("#config/constants");

const withRole = (title, extra = {}) => ({ _id: "u1", role: { title }, ...extra });

describe("article.scope — scopeForRole (dashboard bilan bir xil kesim)", () => {
  it("global rollar → {} (hammasi)", () => {
    [ROLES.ILMIY_BOLIM, ROLES.PROREKTOR, ROLES.REKTOR, ROLES.ILMIY_KENGASH_KOTIBI, ROLES.ADMIN, ROLES.SUPER_ADMIN].forEach(
      (r) => expect(scopeForRole(withRole(r))).toEqual({}),
    );
  });

  it("o'qituvchi → { author: o'zi }", () => {
    expect(scopeForRole(withRole(ROLES.OQITUVCHI))).toEqual({ author: "u1" });
  });

  it("kafedra mudiri → { department }", () => {
    const u = withRole(ROLES.KAFEDRA_MUDIRI, { department: { _id: "d1", faculty: "f1" } });
    expect(scopeForRole(u)).toEqual({ department: "d1" });
  });

  it("dekan → { faculty }", () => {
    const u = withRole(ROLES.DEKAN, { department: { _id: "d1", faculty: "f1" } });
    expect(scopeForRole(u)).toEqual({ faculty: "f1" });
  });

  it("kafedrasiz kafedra mudiri / fakultetsiz dekan → { _id: null } (bo'sh, 403 emas)", () => {
    expect(scopeForRole(withRole(ROLES.KAFEDRA_MUDIRI))).toEqual({ _id: null });
    expect(scopeForRole(withRole(ROLES.DEKAN))).toEqual({ _id: null });
  });

  it("noma'lum rol → faqat o'zi (xavfsiz default)", () => {
    expect(scopeForRole(withRole("nomalum"))).toEqual({ author: "u1" });
  });

  it("global rollar ro'yxati kutilgandek", () => {
    expect([...GLOBAL_ROLES].sort()).toEqual(
      ["admin", "ilmiy_bolim", "ilmiy_kengash_kotibi", "prorektor", "rektor", "super_admin"].sort(),
    );
  });
});

describe("article.scope — middleware", () => {
  const run = (user) =>
    new Promise((resolve) => {
      const req = { user };
      articleScope(req, {}, (err) => resolve({ err, scope: req.scope }));
    });

  it("rektor → req.scope = {} (har qanday maqolani ocha oladi)", async () => {
    const { err, scope } = await run(withRole(ROLES.REKTOR));
    expect(err).toBeUndefined();
    expect(scope).toEqual({});
  });

  it("dekan → req.scope = { faculty }", async () => {
    const { err, scope } = await run(withRole(ROLES.DEKAN, { department: { faculty: "f9" } }));
    expect(err).toBeUndefined();
    expect(scope).toEqual({ faculty: "f9" });
  });

  it("req.user yo'q bo'lsa 500 (authenticate chaqirilmagan)", async () => {
    const { err } = await run(undefined);
    expect(err.status || err.statusCode).toBe(500);
  });
});

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

describe("article.scope — ADR-030 Faza 2 (dekan users.faculty)", () => {
  it("(c) dekan: users.faculty ≠ department.faculty → users.faculty g'olib (Rasulova)", () => {
    const u = withRole(ROLES.DEKAN, {
      role: { title: ROLES.DEKAN, scopeLevel: "faculty" },
      faculty: F_OWN,
      department: { _id: "d1", faculty: F_DEP },
    });
    expect(scopeForRole(u)).toEqual({ faculty: F_OWN });
  });

  it("(a) kafedrasiz dekan, faqat users.faculty → { faculty } ({ _id: null } EMAS)", () => {
    const u = withRole(ROLES.DEKAN, { role: { title: ROLES.DEKAN, scopeLevel: "faculty" }, faculty: F_OWN });
    expect(scopeForRole(u)).toEqual({ faculty: F_OWN });
  });

  it("kafedra mudiri (department-scoped): users.faculty e'tiborsiz, doira kafedra", () => {
    const u = withRole(ROLES.KAFEDRA_MUDIRI, {
      role: { title: ROLES.KAFEDRA_MUDIRI, scopeLevel: "department" },
      faculty: F_OWN,
      department: { _id: "d1", faculty: F_DEP },
    });
    expect(scopeForRole(u)).toEqual({ department: "d1" });
  });
});
