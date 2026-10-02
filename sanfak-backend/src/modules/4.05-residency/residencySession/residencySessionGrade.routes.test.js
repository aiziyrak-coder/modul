"use strict";

const fs = require("fs");
const path = require("path");

const code = (file) =>
  fs
    .readFileSync(path.join(__dirname, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
const routes = code("residencySessionGrade.routes.js");
const parent = code("residencySession.routes.js");

const chainOf = (route) => {
  const at = routes.indexOf(`.route("${route}")`);
  expect(at).toBeGreaterThan(-1);
  const next = routes.indexOf(".route(", at + 1);
  return routes.slice(at, next === -1 ? undefined : next);
};
const inOrder = (chain, parts) => {
  const idx = parts.map((p) => chain.indexOf(p));
  idx.forEach((i) => expect(i).toBeGreaterThan(-1));
  expect([...idx].sort((a, b) => a - b)).toEqual(idx);
};

describe("zanjir", () => {
  test("kontekst: readAll → params → controller", () => {
    const chain = chainOf("/residents/:resident/attendance-context");
    expect(chain).toMatch(/\.get\(\s*P_READ,/);
    inOrder(chain, ["P_READ", "validator.params(V.residentParam)", "C.context"]);
  });

  test("baho: update → params → body → controller", () => {
    const chain = chainOf("/:id/entries/:resident/score");
    expect(chain).toMatch(/\.put\(\s*P_GRADE,/);
    inOrder(chain, ["P_GRADE", "validator.params(V.gradeParams)", "validator.body(V.gradeBody)", "C.grade"]);
  });

  test("ruxsat — faqat mavjud `residentAttendance` (yangi RBAC kaliti yo'q)", () => {
    expect(routes).toContain("const M = MODULES.RESIDENT_ATTENDANCE;");
    expect(routes).toContain("permit(M, [ACTIONS.READ_ALL])");
    expect(routes).toContain("permit(M, [ACTIONS.UPDATE])");
    expect(routes.match(/permit\(/g)).toHaveLength(2);
    expect(routes).not.toMatch(/\.(delete|post)\(/);
  });

  test("ota router: authenticate'dan KEYIN, `/:id` route'laridan OLDIN ulanadi", () => {
    inOrder(parent, ["router.use(authenticate)", 'router.use(require("./residencySessionGrade.routes"))', '.route("/:id/cancel")', '.route("/:id")']);
  });
});

test("router HAQIQATAN yuklanadi — literal route param'dan oldin (§12.2)", () => {
  const router = require("./residencySessionGrade.routes");
  const paths = router.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0]} ${l.route.path}`);
  expect(paths).toEqual(["get /residents/:resident/attendance-context", "put /:id/entries/:resident/score"]);
});
