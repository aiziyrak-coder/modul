"use strict";

const fs = require("fs");
const path = require("path");

const routes = fs
  .readFileSync(path.join(__dirname, "residencySession.routes.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");
const chainOf = (route) => {
  const at = routes.indexOf(`.route("${route}")`);
  expect(at).toBeGreaterThan(-1);
  const next = routes.indexOf(".route(", at + 1);
  return routes.slice(at, next === -1 ? undefined : next);
};
const L2_ROUTES = [
  ["post", "/", "P_ANNOUNCE"],
  ["get", "/paginate", "P_READ"],
  ["get", "/unsupervised-residents", "P_ANNOUNCE"],
  ["put", "/:id/cancel", "P_CANCEL"],
  ["get", "/:id", "P_READ"],
];

describe("zanjir", () => {
  test.each(L2_ROUTES)("%s %s — `%s` bilan BOSHLANADI", (method, route, gate) => {
    expect(chainOf(route)).toMatch(new RegExp(`\\.${method}\\(\\s*${gate},`));
  });

  test("ruxsat — faqat mavjud `residentAttendance` (yangi RBAC kaliti yo'q)", () => {
    expect(routes).toContain("const M = MODULES.RESIDENT_ATTENDANCE;");
    expect(routes).toContain("permit(M, [ACTIONS.CREATE])");
    expect(routes).toContain("permit(M, [ACTIONS.READ_ALL])");
    expect(routes).toContain("permit(M, [ACTIONS.UPDATE])");
    expect(routes.match(/permit\(/g)).toHaveLength(3);
    expect(routes).toContain("router.use(authenticate)");
  });

  test("validator controller'dan OLDIN", () => {
    const cancel = chainOf("/:id/cancel");
    const order = ["P_CANCEL", "validator.params(V.idSchema)", "validator.body(V.cancelSchema)", "C.cancel"].map((p) => cancel.indexOf(p));
    order.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(chainOf("/")).toContain("validator.body(V.announceSchema), C.announce");
  });

  test("DELETE va umumiy PUT YO'Q (sessiya o'zgarmas)", () => {
    expect(routes).not.toMatch(/\.delete\(/);
    expect(chainOf("/:id")).not.toMatch(/\.put\(/);
  });
});

test("router HAQIQATAN yuklanadi; L2 route'lari bor va `/:id` literallardan KEYIN (§12.2)", () => {
  const router = require("./residencySession.routes");
  const paths = router.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0]} ${l.route.path}`);
  const idx = L2_ROUTES.map(([m, r]) => paths.indexOf(`${m} ${r}`));
  idx.forEach((i) => expect(i).toBeGreaterThan(-1));
  expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  const idRoute = paths.indexOf("get /:id");
  paths.filter((p) => !p.includes(":id")).forEach((p) => expect(paths.indexOf(p)).toBeLessThan(idRoute));
});
