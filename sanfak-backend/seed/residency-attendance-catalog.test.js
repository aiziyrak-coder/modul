"use strict";

const fs = require("fs");
const path = require("path");
const { CRUD_ACTIONS } = require("./_module-permission-lib");
const { GRANTS } = require("./residency-roles.seed");
const { MODULES, ACTIONS } = require("../src/config/constants");

const LINE = "[MODULES.RESIDENT_ATTENDANCE]: [...CRUD_ACTIONS, ACTIONS.APPROVE],";

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

function objectBody(file, name) {
  const src = stripComments(fs.readFileSync(path.join(__dirname, file), "utf8"));
  const m = src.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\r?\\n\\};`));
  if (!m) throw new Error(`${file}: ${name} topilmadi`);
  return m[1];
}

const KEY = "[MODULES.RESIDENT_ATTENDANCE]:";
const count = (s, sub) => s.split(sub).length - 1;

describe("residentAttendance katalogi — approve (EXC-Q1 / D-18)", () => {
  test.each([
    ["permissions.seed.js", "MODULE_ACTIONS_OVERRIDE"],
    ["permissions-residency.seed.js", "ACTIONS_OVERRIDE"],
  ])("%s: %s da CRUD + approve, kalit bitta marta", (file, name) => {
    const body = objectBody(file, name);
    expect(body).toContain(LINE);
    expect(count(body, KEY)).toBe(1);
  });

  test("permissions-residency.seed.js: section modul ro'yxatida (override ishlatiladi)", () => {
    const src = stripComments(fs.readFileSync(path.join(__dirname, "permissions-residency.seed.js"), "utf8"));
    expect(src).toMatch(/const SECTIONS = \[[\s\S]*?MODULES\.RESIDENT_ATTENDANCE,[\s\S]*?\];/);
  });

  test("har rolning residentAttendance granti katalog ichida", () => {
    const catalogue = [...CRUD_ACTIONS, ACTIONS.APPROVE];
    for (const [role, sections] of Object.entries(GRANTS)) {
      for (const action of sections[MODULES.RESIDENT_ATTENDANCE] ?? []) {
        expect([role, catalogue.includes(action)]).toEqual([role, true]);
      }
    }
  });
});
