"use strict";

const fs = require("fs");
const path = require("path");

const MODULE_DIR = path.join(__dirname, "..");

const ALLOWLIST = [
  {
    file: "_services/expulsionCheck.js",
    select: "firstName lastName",
    why: "expulsionCheck — Telegram xabari uchun ism YASAYDI (`buildFullName`), populate ustuni emas",
  },
  {
    file: "resident/resident.controller.js",
    select: "firstName lastName active",
    why: "assignSupervisor — `supervisorName` SNAPSHOT'ini yozadi",
  },
];

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) {
      out.push(full);
    }
  }
  return out;
}

function nameSelects() {
  const found = [];
  for (const full of sourceFiles(MODULE_DIR)) {
    const rel = path.relative(MODULE_DIR, full).split(path.sep).join("/");
    const src = fs.readFileSync(full, "utf8");
    for (const m of src.matchAll(/"([^"\n]*)"/g)) {
      const literal = m[1];
      if (literal.includes("firstName") && literal.includes("lastName")) {
        found.push({ file: rel, select: literal });
      }
    }
  }
  return found;
}

const isAllowed = (row) =>
  ALLOWLIST.some((a) => a.file === row.file && a.select === row.select);

describe("F.I.Sh — `middleName` populate selektlarida", () => {
  it("skaner haqiqatan ish topadi (test o'zi bo'sh o'tib ketmasin)", () => {
    expect(nameSelects().length).toBeGreaterThan(8);
  });

  it("`firstName`+`lastName` so'ragan har bir selekt `middleName` ni ham so'raydi", () => {
    const missing = nameSelects()
      .filter((r) => !r.select.includes("middleName"))
      .filter((r) => !isAllowed(r));
    expect(missing).toEqual([]);
  });

  it.each([
    ["resident/resident.controller.js", 2],
    ["dailyLog/dailyLog.controller.js", 1],
    ["_services/workPlanService.js", 1],
    ["attendance/attendance.controller.js", 3],
    ["residentApplication/residentApplication.controller.js", 1],
  ])("%s — kamida %i ta selekt `middleName` bilan", (file, count) => {
    const rows = nameSelects().filter(
      (r) => r.file === file && r.select.includes("middleName"),
    );
    expect(rows.length).toBeGreaterThanOrEqual(count);
  });

  it("ALLOWLIST eskirmagan — yo hamon kerak, yo umuman keraksiz", () => {
    const all = nameSelects();
    for (const a of ALLOWLIST) {
      const stillThere = all.some(
        (r) => r.file === a.file && r.select === a.select,
      );
      const exemptionStillNeeded = all.some(
        (r) => r.file === a.file && !r.select.includes("middleName"),
      );
      expect(stillThere || !exemptionStillNeeded).toBe(true);
    }
  });
});
