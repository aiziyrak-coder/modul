"use strict";

const { PassThrough } = require("stream");
const { officeOnly, displayName } = require("./residencyExpulsionOrder.upload");

describe("officeOnly — multer'dan OLDIN (fayl xotiraga o'qilmaydi)", () => {
  test.each([
    ["super_admin", { role: { title: "super_admin" } }],
    ["admin", { role: { title: "admin" } }],
    ["rolsiz", {}],
    ["foydalanuvchisiz", undefined],
  ])("%s → next(403 `not_office_signer`)", (_label, user) => {
    const next = jest.fn();
    officeOnly({ user }, {}, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, meta: { reason: "not_office_signer" } }),
    );
  });

  test("bo'lim xodimi → next() (xatosiz)", () => {
    const next = jest.fn();
    officeOnly({ user: { role: { title: "magistratura_bolim" } } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("displayName — ko'rsatish uchun, kengaytma BAYTDAN", () => {
  const latin1 = (s) => Buffer.from(s, "utf8").toString("latin1");
  test.each([
    ["UTF-8 nom (busboy latin1)", latin1("Buyruq №12.pdf"), "pdf", "Buyruq №12.pdf"],
    ["mijoz kengaytmasi almashtiriladi", "buyruq-12.bat", "pdf", "buyruq-12.pdf"],
    ["bidi belgisi olib tashlanadi", latin1("a‮fdp.exe"), "pdf", "afdp.pdf"],
    ["yo'l ajratgichlari", "../../x.exe", "pdf", "....x.pdf"],
    ["bo'sh nom", "", "png", "buyruq-skan.png"],
    ["kengaytmasiz", "skan", "jpg", "skan.jpg"],
    ["nuqtali sana — kengaytma emas", "Buyruq 12.10.2026", "pdf", "Buyruq 12.10.2026.pdf"],
  ])("%s", (_label, name, ext, expected) => {
    expect(displayName(name, ext)).toBe(expected);
  });
});

describe("controller — yuklab olish oqimi", () => {
  test("mijoz uzilsa fayl oqimi YOPILADI (`pipeline`)", async () => {
    const source = new PassThrough();
    jest.resetModules();
    jest.doMock("./residencyExpulsionOrder.service", () => ({
      scanForDownload: jest.fn().mockResolvedValue({ scan: { fileName: "b.pdf", storageKey: "k" }, size: 3 }),
      createReadStream: jest.fn(() => source),
    }));
    const C = require("./residencyExpulsionOrder.controller");
    const res = new PassThrough();
    res.setHeader = jest.fn();
    await C.downloadScan({ params: { id: "x" }, user: {} }, res, jest.fn());
    source.write("a");
    res.destroy();
    await new Promise((r) => setImmediate(r));
    expect(source.destroyed).toBe(true);
    jest.dontMock("./residencyExpulsionOrder.service");
  });
});

describe("controller — xato mapping", () => {
  test("kutilmagan xato → 500, `ErrorHandler` → o'zgarishsiz", async () => {
    jest.resetModules();
    jest.doMock("./residencyExpulsionOrder.service", () => ({ findOne: jest.fn() }));
    const C = require("./residencyExpulsionOrder.controller");
    const { ErrorHandler } = require("#shared/error");
    const service = require("./residencyExpulsionOrder.service");
    const deliberate = new ErrorHandler(409, "x", "order_not_open", { reason: "order_not_open" });
    service.findOne
      .mockRejectedValueOnce(new Error("ENOTDIR C:\\srv\\x"))
      .mockRejectedValueOnce(deliberate);
    const next = jest.fn();
    const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
    await C.findOne({ params: { id: "x" }, user: {} }, res, next);
    await C.findOne({ params: { id: "x" }, user: {} }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 500 });
    expect(next.mock.calls[1][0]).toBe(deliberate);
    jest.dontMock("./residencyExpulsionOrder.service");
  });
});

describe("controller — loyiha PDF'i", () => {
  const load = (impl) => {
    jest.resetModules();
    jest.doMock("./residencyExpulsionOrder.service", () => ({ draftPdfForDownload: jest.fn(impl) }));
    return require("./residencyExpulsionOrder.controller");
  };
  afterEach(() => jest.dontMock("./residencyExpulsionOrder.service"));

  test("tekshirilgan bufer bitta yozuvda, sarlavhalar skan bilan bir xil", async () => {
    const buffer = Buffer.from("%PDF-1.3 x");
    const C = load(async () => ({ draftPdf: { fileName: "chetlatish-buyrugi-loyihasi-0000a1-20.10.2026.pdf" }, buffer }));
    const res = { setHeader: jest.fn(), end: jest.fn() };
    await C.downloadDraftPdf({ params: { id: "x" }, user: {} }, res, jest.fn());
    expect(Object.fromEntries(res.setHeader.mock.calls)).toEqual({
      "Content-Type": "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": buffer.length,
      "Cache-Control": "private, no-store",
      "Content-Disposition": expect.stringMatching(/^attachment; filename="chetlatish-buyrugi-loyihasi-0000a1-20\.10\.2026\.pdf"/),
    });
    expect(res.end).toHaveBeenCalledWith(buffer);
  });

  test("servis xatosi — birorta sarlavha qo'yilmaydi, xato `next` ga", async () => {
    const C = load(async () => {
      throw new Error("sha256");
    });
    const res = { setHeader: jest.fn(), end: jest.fn() };
    const next = jest.fn();
    await C.downloadDraftPdf({ params: { id: "x" }, user: {} }, res, next);
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 500 });
  });
});
