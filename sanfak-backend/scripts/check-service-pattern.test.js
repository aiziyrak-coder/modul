"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const ALLOWLIST_PATH = path.join(__dirname, "service-pattern.allowlist.json");

function collectControllers(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectControllers(full, acc);
    else if (entry.name.endsWith(".controller.js")) acc.push(full);
  }
  return acc;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

describe("Arxitektura — servis naqshi (BACKEND-TASTE)", () => {
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
  const muzlatilgan = new Set(allowlist.servissiz);

  const controllers = collectControllers(SRC);
  const servissiz = controllers
    .filter((c) => !fs.existsSync(c.replace(/\.controller\.js$/, ".service.js")))
    .map(rel);

  test("yangi kontroller servissiz qo'shilmagan", () => {
    const yangi = servissiz.filter((f) => !muzlatilgan.has(f));
    expect({ yangiServissizKontrollerlar: yangi }).toEqual({
      yangiServissizKontrollerlar: [],
    });
  });

  test("allowlist eskirmagan — servis qo'shilgan qator o'chirilgan", () => {
    const hozirServissiz = new Set(servissiz);
    const eskirgan = [...muzlatilgan].filter((f) => !hozirServissiz.has(f));
    expect({ allowlistdanOchirilishiKerak: eskirgan }).toEqual({
      allowlistdanOchirilishiKerak: [],
    });
  });

  test("allowlistdagi har bir fayl hali ham mavjud", () => {
    const yoq = [...muzlatilgan].filter((f) => !fs.existsSync(path.join(ROOT, f)));
    expect({ mavjudEmas: yoq }).toEqual({ mavjudEmas: [] });
  });
});
