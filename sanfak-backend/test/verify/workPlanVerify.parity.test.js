const fs = require("fs");
const path = require("path");

const Doc = require("#modules/4.02-studyLoad/_verify/documentVerify.controller");
const Plan = require("#modules/4.03-teacher/_verify/workPlanVerify.controller");

const ROOT = path.join(__dirname, "..", "..", "src");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const headersOf = (fn) => {
  const set = {};
  fn({ set: (k, v) => { set[k] = v; } });
  return set;
};

describe("4.03 ↔ 4.02 verify parity", () => {
  test("«Topilmadi» sahifasi bayt-bayt bir xil", () => {
    expect(Plan.renderInvalid()).toBe(Doc.renderInvalid());
  });

  test("xavfsizlik header'lari bir xil", () => {
    expect(headersOf(Plan.setSecurityHeaders)).toEqual(headersOf(Doc.setSecurityHeaders));
  });

  test("escapeHtml / fmtDate bir xil xulq", () => {
    const s = `<a href="x">'&'</a>`;
    expect(Plan.escapeHtml(s)).toBe(Doc.escapeHtml(s));
    expect(Plan.fmtDate("2026-09-26T10:00:00Z")).toBe(Doc.fmtDate("2026-09-26T10:00:00Z"));
  });
});

describe("src/index.js — /verify/plan ulanishi", () => {
  const index = read("index.js");

  test("morgan skip — `originalUrl` predikati (`#shared/verifyLogSkip`; xulqi test/shared da)", () => {
    expect(index).toMatch(/skip: isVerifyTokenPath,/);
  });

  test("`/verify/plan` — `/verify` (4.04) dan OLDIN, publicReadLimiter ostida", () => {
    const plan = index.indexOf('app.use("/verify/plan", publicReadLimiter, workPlanVerifyRoutes)');
    const cert = index.indexOf('app.use("/verify", publicReadLimiter, certificateVerifyRoutes)');
    expect(plan).toBeGreaterThan(-1);
    expect(plan).toBeLessThan(cert);
  });
});

describe("grep-darvoza — yangi 4.03 fayllarida 4.02 importi yo'q", () => {
  const FILES = [
    "modules/4.03-teacher/_verify/workPlanVerify.service.js",
    "modules/4.03-teacher/_verify/workPlanVerify.controller.js",
    "modules/4.03-teacher/_verify/workPlanVerify.routes.js",
    "modules/4.03-teacher/_shared/verifyQr.js",
    "modules/4.03-teacher/_shared/workPlanSignatories.js",
  ];
  test.each(FILES)("%s", (rel) => {
    const code = read(rel).split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    expect(code).not.toMatch(/4\.02-studyLoad/);
  });
});

describe("model — verify.token indeksi (ADR-020 Invariant #4)", () => {
  test("unique + partialFilterExpression ($type string); token'ga default YO'Q", () => {
    const Model = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
    const idx = Model.schema.indexes().find(([fields]) => fields["verify.token"] === 1);
    expect(idx[1]).toMatchObject({ unique: true, partialFilterExpression: { "verify.token": { $type: "string" } } });
    expect(Model.schema.path("verify.token").defaultValue).toBeUndefined();
  });
});
