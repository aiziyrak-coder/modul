"use strict";

const contingentReportScope = require("./contingentReport.scope");

const run = (user) =>
  new Promise((resolve) => {
    const req = { user };
    contingentReportScope()(req, {}, (err) => resolve({ err, scope: req.scope }));
  });

describe("contingentReportScope", () => {
  test("global rol (O'UB) → {}", async () => {
    const { err, scope } = await run({ role: { title: "oquv_uslubiy_boshqarma", scopeLevel: "global" } });
    expect(err).toBeUndefined();
    expect(scope).toEqual({});
  });

  test("dekan — `users.faculty` birlamchi (ADR-030)", async () => {
    const { err, scope } = await run({
      role: { title: "dekan", scopeLevel: "faculty" },
      faculty: "f-own",
      department: { _id: "d1", faculty: "f-dept" },
    });
    expect(err).toBeUndefined();
    expect(scope).toEqual({ faculty: "f-own" });
  });

  test("kotib — fakulteti kafedradan (zaxira)", async () => {
    const { scope } = await run({
      role: { title: "fakultet_kengash_kotibi", scopeLevel: "faculty" },
      department: { _id: "d1", faculty: "f-dept" },
    });
    expect(scope).toEqual({ faculty: "f-dept" });
  });

  test("fakulteti aniqlanmagan faculty-rol → 403", async () => {
    const { err } = await run({ role: { title: "dekan", scopeLevel: "faculty" } });
    expect(err).toMatchObject({ statusCode: 403 });
  });

  test.each(["department", "self", undefined])("scopeLevel=%s → 403 (fail-closed)", async (scopeLevel) => {
    const { err } = await run({ role: { title: "kafedra_mudiri", scopeLevel }, department: { _id: "d1", faculty: "f" } });
    expect(err).toMatchObject({ statusCode: 403 });
  });

  test("rol yo'q → 403; req.user yo'q → 500", async () => {
    expect((await run({})).err).toMatchObject({ statusCode: 403 });
    expect((await run(undefined)).err).toMatchObject({ statusCode: 500 });
  });
});
