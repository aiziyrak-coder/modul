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
const routes = code("samsStatus.routes.js");
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

describe("samsStatus.routes — ruxsat va tartib", () => {
  it("router darajasida authenticate (va no-store)", () => {
    expect(routes).toMatch(/router\.use\(authenticate, noStore\)/);
  });

  it("F4 kaliti — residencyLesson:update (readAll EMAS)", () => {
    expect(routes).toContain("const P = permit(MODULES.RESIDENCY_LESSON, [ACTIONS.UPDATE])");
    expect(routes).not.toMatch(/RESIDENCY_LESSON, \[ACTIONS\.READ_ALL\]/);
  });

  it.each([
    ["/overview", ["P", "validator.query(V.overviewQuery)", "C.overview"]],
    ["/days", ["P", "validator.query(V.daysQuery)", "C.days"]],
    ["/warnings", ["P", "validator.query(V.warningsQuery)", "C.warnings"]],
    ["/clinics/:dbname/days/:day", ["P", "validator.params(V.clinicDayParams)", "validator.query(V.pageQuery)", "C.clinicDay"]],
  ])("%s: permit → Joi → controller", (route, parts) => {
    const chain = chainOf(route);
    inOrder(chain, parts);
    expect(chain).toMatch(/\.get\(\s*P,/);
  });

  it("baseline: residentAttendance:readAll → Joi → controller (doira controller'da)", () => {
    expect(routes).toContain("const permitResidentRead = permit(MODULES.RESIDENT_ATTENDANCE, [ACTIONS.READ_ALL])");
    inOrder(chainOf("/residents/:resident/baseline"), [
      "permitResidentRead", "validator.params(V.residentParams)", "validator.query(V.baselineQuery)", "C.residentBaseline",
    ]);
    const controller = code("samsStatus.controller.js");
    inOrder(controller, ["buildResidentScope(req.user, resident)", "if (denied)", "S.residentExists(resident)", "S.residentBaseline("]);
  });

  it("faqat GET; `/:id` yo'q", () => {
    expect(routes).not.toMatch(/\.(post|put|patch|delete)\(/);
    expect(routes).not.toMatch(/route\("\/:id/);
  });

  it("modul index'i `/residency-sams-status` ga ulaydi (`/residency-sams` ostida EMAS)", () => {
    const index = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
    expect(index).toContain('router.use("/residency-sams-status", require("./samsIngest/samsStatus.routes"))');
  });
});
