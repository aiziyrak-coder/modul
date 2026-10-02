"use strict";

const os = require("os");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "p6a2-files-"));
process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = ROOT;

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
const files = require("./expulsionOrderFiles");

const REPO = path.resolve(__dirname, "../../../..");
const withHead = (head, size = 64) => Buffer.concat([Buffer.from(head), Buffer.alloc(size, 0x20)]);

afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));
afterEach(() => {
  process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = ROOT;
});

describe("detectScanType — AYNAN uch tur, baytdan", () => {
  test.each([
    ["PDF", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], "application/pdf", "pdf"],
    ["JPEG", [0xff, 0xd8, 0xff, 0xe0], "image/jpeg", "jpg"],
    ["PNG", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png", "png"],
  ])("%s qabul qilinadi", (_label, head, mimeType, ext) => {
    expect(files.detectScanType(withHead(head))).toEqual({ mimeType, ext });
  });

  test.each([
    ["GIF", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    ["WEBP (RIFF)", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ["EXE (MZ)", [0x4d, 0x5a, 0x90, 0x00]],
    ["ZIP", [0x50, 0x4b, 0x03, 0x04]],
    ["PDF boshi yarim (`%PDF` + boshqa)", [0x25, 0x50, 0x44, 0x46, 0x00]],
  ])("%s rad etiladi", (_label, head) => {
    expect(files.detectScanType(withHead(head))).toBeNull();
  });

  test.each([
    ["bo'sh", Buffer.alloc(0)],
    ["faqat imzo baytlari", Buffer.from([0xff, 0xd8, 0xff])],
    ["bufer emas", "%PDF-1.7"],
  ])("%s — rad", (_label, value) => {
    expect(files.detectScanType(value)).toBeNull();
  });
});

describe("saqlash", () => {
  test("kalit `yyyy/mm/uuid.ext`, sha256 va hajm to'g'ri, fayl ildiz ICHIDA", async () => {
    const buf = withHead([0x25, 0x50, 0x44, 0x46, 0x2d], 100);
    const saved = await files.save(buf, "pdf");
    expect(saved.storageKey).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
    expect(saved.size).toBe(buf.length);
    expect(saved.sha256).toBe(crypto.createHash("sha256").update(buf).digest("hex"));
    expect(fs.readFileSync(path.join(ROOT, saved.storageKey))).toEqual(buf);
    expect((await files.stat(saved.storageKey)).size).toBe(buf.length);
    await files.remove(saved.storageKey);
    expect(await files.stat(saved.storageKey)).toBeNull();
  });

  test("ildizdan tashqariga chiqadigan kalit — rad", () => {
    expect(() => files.resolveAbsolute("../../etc/passwd")).toThrow(/Yaroqsiz/);
    expect(() => files.resolveAbsolute("")).toThrow(/Yaroqsiz/);
  });
});

describe("ildiz statik papka ichida — chaqiruv paytida 500", () => {
  test.each([
    ["uploads/", path.join(REPO, "uploads", "residency-expulsion-orders")],
    ["public/build", path.join(REPO, "public", "build", "x")],
  ])("%s → 500 `scan_root_public`", (_label, dir) => {
    process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = dir;
    expect(() => files.resolveRoot()).toThrow(expect.objectContaining({ statusCode: 500 }));
  });

  test("noto'g'ri sozlangan ildiz modul YUKLANISHINI yiqitmaydi", () => {
    process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = path.join(REPO, "uploads");
    jest.isolateModules(() => {
      expect(() => require("./expulsionOrderFiles")).not.toThrow();
    });
  });

  test("standart ildiz — `<FILEPATH>private/residency-expulsion-orders`", () => {
    delete process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR;
    expect(files.resolveRoot()).toBe(path.resolve("./private/residency-expulsion-orders"));
  });
});

describe("ko'rik (P6a-2) — haqiqiy yo'l va xato turlari", () => {
  test("`uploads/` ichiga ko'rsatuvchi junction ildiz — 500", () => {
    const target = fs.mkdtempSync(path.join(REPO, "uploads", "p6a2-junction-"));
    const link = path.join(ROOT, "link-root");
    try {
      fs.symlinkSync(target, link, "junction");
      process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = link;
      expect(() => files.resolveRoot()).toThrow(expect.objectContaining({ statusCode: 500 }));
    } finally {
      fs.rmSync(link, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test("junction ichidagi hali yo'q ildiz — 500 (birinchi `mkdir` dan oldin)", () => {
    const target = fs.mkdtempSync(path.join(REPO, "uploads", "p6a2-junction-"));
    const link = path.join(ROOT, "link-root-2");
    try {
      fs.symlinkSync(target, link, "junction");
      process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = path.join(link, "scans", "deep");
      expect(() => files.resolveRoot()).toThrow(expect.objectContaining({ statusCode: 500 }));
    } finally {
      fs.rmSync(link, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test("`stat`: fayl yo'q — `null`; ruxsat xatosi — yuqoriga (dalil «yo'q» bo'lib ko'rinmasin)", async () => {
    expect(await files.stat("2026/01/yoq.pdf")).toBeNull();
    const spy = jest.spyOn(require("fs/promises"), "stat").mockRejectedValueOnce(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    await expect(files.stat("2026/01/x.pdf")).rejects.toThrow("EACCES");
    spy.mockRestore();
  });
});

describe("loyiha PDF'i (P6a-3) — `draft/` prefiksi va tekshirilgan o'qish", () => {
  test("prefiks bilan kalit `draft/yyyy/mm/uuid.pdf`, ildiz ICHIDA; `readFile` baytni qaytaradi", async () => {
    const buf = withHead([0x25, 0x50, 0x44, 0x46, 0x2d], 200);
    const saved = await files.save(buf, "pdf", { prefix: "draft" });
    expect(saved.storageKey).toMatch(/^draft\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
    expect(fs.readFileSync(path.join(ROOT, saved.storageKey))).toEqual(buf);
    expect(await files.readFile(saved.storageKey)).toEqual(buf);
  });

  test.each([["../x"], ["Draft"], ["draft/sub"], ["dr4ft"]])("yaroqsiz prefiks %s — throw, diskka yozilmaydi", async (prefix) => {
    await expect(files.save(Buffer.from("%PDF-x"), "pdf", { prefix })).rejects.toThrow(/Yaroqsiz prefix/);
  });

  test("`readFile`: fayl yo'q — `null`; ruxsat xatosi — yuqoriga", async () => {
    expect(await files.readFile("draft/2026/01/yoq.pdf")).toBeNull();
    const spy = jest.spyOn(require("fs/promises"), "readFile").mockRejectedValueOnce(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    await expect(files.readFile("draft/2026/01/x.pdf")).rejects.toThrow("EACCES");
    spy.mockRestore();
  });

  test("`readFile` ildizdan tashqariga chiqmaydi va statik ildizni rad etadi", async () => {
    await expect(files.readFile("../../etc/passwd")).rejects.toThrow(/Yaroqsiz/);
    process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = path.join(REPO, "uploads", "x");
    await expect(files.readFile("draft/2026/01/a.pdf")).rejects.toEqual(expect.objectContaining({ statusCode: 500 }));
  });
});
