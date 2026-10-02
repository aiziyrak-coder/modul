const { scopeFor: dashboardScopeFor } = require("./dashboard.service");
const { scopeFor: statisticsScopeFor } = require("./statistics.service");
const { ROLES } = require("#config/constants");

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

const dekan = (extra = {}) => ({
  _id: "u-dekan",
  role: { title: ROLES.DEKAN, scopeLevel: "faculty" },
  ...extra,
});

describe.each([
  ["dashboard.service", dashboardScopeFor],
  ["statistics.service", statisticsScopeFor],
])("%s.scopeFor — ADR-030 Faza 2", (_name, scopeFor) => {
  test("(c) dekan: users.faculty ≠ department.faculty → users.faculty g'olib", () => {
    const u = dekan({ faculty: F_OWN, department: { _id: "d1", faculty: F_DEP } });
    expect(scopeFor(u, "author")).toEqual({ faculty: F_OWN });
  });

  test("(a) kafedrasiz dekan, faqat users.faculty → { faculty } ({ _id: null } EMAS)", () => {
    expect(scopeFor(dekan({ faculty: F_OWN, department: null }), "author")).toEqual({ faculty: F_OWN });
  });

  test("(b) faqat department.faculty → zaxira (avvalgi xulq)", () => {
    expect(scopeFor(dekan({ department: { _id: "d1", faculty: F_DEP } }), "author")).toEqual({ faculty: F_DEP });
  });

  test("fakultetsiz va kafedrasiz dekan → { _id: null } (bo'sh, 403 emas — avvalgidek)", () => {
    expect(scopeFor(dekan({ faculty: null, department: null }), "author")).toEqual({ _id: null });
  });

  test("kafedra mudiri: users.faculty e'tiborsiz, doira kafedra", () => {
    const u = { _id: "u-m", role: { title: ROLES.KAFEDRA_MUDIRI, scopeLevel: "department" }, faculty: F_OWN, department: { _id: "d1", faculty: F_DEP } };
    expect(scopeFor(u, "author")).toEqual({ department: "d1" });
  });

  test("o'qituvchi → { author: o'zi } (o'zgarmagan)", () => {
    const u = { _id: "u-t", role: { title: ROLES.OQITUVCHI, scopeLevel: "self" }, faculty: F_OWN };
    expect(scopeFor(u, "author")).toEqual({ author: "u-t" });
  });
});
