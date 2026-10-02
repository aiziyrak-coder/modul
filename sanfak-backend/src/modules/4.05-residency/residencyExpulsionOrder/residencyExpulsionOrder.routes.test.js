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
const routes = code("residencyExpulsionOrder.routes.js");
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

describe("zanjir tartibi", () => {
  test("har route `permit` bilan BOSHLANADI (`P`)", () => {
    for (const route of ["/paginate", "/:id/scan", "/:id/draft-pdf", "/:id/sign", "/:id/reject", "/:id"]) {
      for (const m of chainOf(route).matchAll(/\.(get|put)\(\s*(\w+)/g)) expect(m[2]).toBe("P");
    }
    expect(routes).toContain("permit(MODULES.RESIDENT, [ACTIONS.CHANGE_STATUS])");
  });

  test("imzo: `officeOnly` → validator → `requireEri({ optional: true })` → controller", () => {
    inOrder(chainOf("/:id/sign"), ["officeOnly", "validator.body(V.signSchema)", "requireEri({ optional: true })", "C.sign"]);
  });

  test("rad etish va yuklab olish ham `officeOnly` bilan", () => {
    inOrder(chainOf("/:id/reject"), ["officeOnly", "validator.body(V.rejectSchema)", "C.reject"]);
    inOrder(chainOf("/:id/scan"), ["officeOnly", "C.downloadScan"]);
    inOrder(chainOf("/:id/draft-pdf"), ["validator.params(V.idSchema)", "officeOnly", "C.downloadDraftPdf"]);
  });

  test("loyiha PDF'i: `.head` `.get` dan OLDIN va hech narsa yaratmaydi", () => {
    inOrder(chainOf("/:id/draft-pdf"), [".head(C.draftPdfHead)", ".get(P"]);
  });

  test("skan: `officeOnly` → `receiveScan` → controller", () => {
    inOrder(chainOf("/:id/scan"), ["validator.params(V.idSchema)", "officeOnly", "receiveScan", "C.uploadScan"]);
  });

  test("literal va sub-resurs route'lar `/:id` dan OLDIN (§12.2)", () => {
    const order = ['"/paginate"', '"/:id/scan"', '"/:id/draft-pdf"', '"/:id/sign"', '"/:id/reject"', '.route("/:id")'].map((r) =>
      routes.indexOf(r),
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("POST / umumiy PUT / DELETE YO'Q", () => {
    expect(routes).not.toMatch(/\.(post|delete)\(/);
    expect(chainOf("/:id")).not.toMatch(/\.put\(/);
  });
});

describe("yuklash yo'li `uploads/` ga tegmaydi", () => {
  test.each(["residencyExpulsionOrder.routes.js", "residencyExpulsionOrder.upload.js", "residencyExpulsionOrder.service.js"])(
    "%s `#shared/uploadFiles` ni talab qilmaydi",
    (file) => {
      expect(code(file)).not.toContain("#shared/uploadFiles");
    },
  );

  test("multer — `memoryStorage`, bitta fayl", () => {
    const upload = code("residencyExpulsionOrder.upload.js");
    expect(upload).toContain("multer.memoryStorage()");
    expect(upload).toContain("files: 1");
  });
});

test("router HAQIQATAN yuklanadi (4.05 SKIP bo'lmasin)", () => {
  const router = require("./residencyExpulsionOrder.routes");
  const paths = router.stack.filter((l) => l.route).map((l) => l.route.path);
  expect(paths).toEqual(["/paginate", "/:id/scan", "/:id/draft-pdf", "/:id/sign", "/:id/reject", "/:id"]);
});

test("HEAD /:id/draft-pdf — 405, `Allow: GET`, servis chaqirilmaydi", async () => {
  const C = require("./residencyExpulsionOrder.controller");
  const res = { set: jest.fn(() => res), status: jest.fn(() => res), end: jest.fn(() => res) };
  C.draftPdfHead({}, res);
  expect(res.set).toHaveBeenCalledWith("Allow", "GET");
  expect(res.status).toHaveBeenCalledWith(405);
  const draft = require("./residencyExpulsionOrder.routes").stack.find((l) => l.route?.path === "/:id/draft-pdf");
  expect(draft.route.stack[0]).toMatchObject({ method: "head" });
  expect(draft.route.stack[0].handle).toBe(C.draftPdfHead);
});
