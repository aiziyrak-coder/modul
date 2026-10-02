"use strict";

const fs = require("fs");
const path = require("path");

const MODULE_DIR = path.join(__dirname, "..");

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

function aggregatePaginateCalls() {
  const found = [];
  for (const full of sourceFiles(MODULE_DIR)) {
    const rel = path.relative(MODULE_DIR, full).split(path.sep).join("/");
    const src = fs.readFileSync(full, "utf8");
    for (const m of src.matchAll(/\.aggregatePaginate\s*\(/g)) {
      found.push({
        file: rel,
        window: src.slice(m.index, m.index + 1200),
      });
    }
  }
  return found;
}

describe("aggregatePaginate — `useFacet: false` tuzog'i", () => {
  it("skaner haqiqatan fayllarni o'qiydi (bo'sh o'tib ketmasin)", () => {
    expect(sourceFiles(MODULE_DIR).length).toBeGreaterThan(50);
  });

  it("har bir chaqiruv `useFacet: false` bilan ochiladi", () => {
    const bad = aggregatePaginateCalls().filter(
      (c) => !/useFacet\s*:\s*false/.test(c.window),
    );
    expect(bad.map((c) => c.file)).toEqual([]);
  });

  it("qo'lda `$skip`/`$limit` bilan sahifalangan agregatsiya ham yo'q", () => {
    const offenders = [];
    for (const full of sourceFiles(MODULE_DIR)) {
      const src = fs.readFileSync(full, "utf8");
      if (!/\$group/.test(src)) continue;
      if (/\$skip/.test(src)) {
        offenders.push(path.relative(MODULE_DIR, full).split(path.sep).join("/"));
      }
    }
    expect(offenders).toEqual([]);
  });
});
