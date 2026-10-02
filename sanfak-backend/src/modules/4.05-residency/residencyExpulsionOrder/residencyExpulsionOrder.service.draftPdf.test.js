jest.mock("./residencyExpulsionOrder.model");
jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  canAccessResident: jest.fn(() => true),
  deletedResidentIds: jest.fn().mockResolvedValue([]),
  residentIdsFor: jest.fn().mockResolvedValue(null),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOfficeNotices", () => ({ deliverDecision: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/expulsionCheck", () => ({
  countUnexcusedHours: jest.fn(),
  sumUnexcusedHours: (rows) => rows.reduce((sum, a) => sum + (a.hours || 2), 0),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOrderDecision", () => ({
  ...jest.requireActual("#modules/4.05-residency/_services/expulsionOrderDecision"),
  attachDraftPdf: jest.fn(),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOrderFiles", () => ({
  save: jest.fn(),
  readFile: jest.fn(),
  remove: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.05-residency/_services/expulsionDraftData", () => ({
  loadDraftResident: jest.fn(),
  loadDraftRows: jest.fn(),
  toDraftInput: jest.fn((args) => ({ marker: "input", total: args.total })),
}));
jest.mock("#modules/4.05-residency/_pdf/expulsionOrderDraft.pdf", () => ({
  buildExpulsionDraftPdf: jest.fn(),
  draftFileName: jest.fn(() => "chetlatish-buyrugi-loyihasi-0000a1-20.10.2026.pdf"),
  TEMPLATE_VERSION: 1,
}));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const crypto = require("crypto");
const Order = require("./residencyExpulsionOrder.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const winston = require("#shared/winston.logger");
const { attachDraftPdf } = require("#modules/4.05-residency/_services/expulsionOrderDecision");
const files = require("#modules/4.05-residency/_services/expulsionOrderFiles");
const draftData = require("#modules/4.05-residency/_services/expulsionDraftData");
const { buildExpulsionDraftPdf } = require("#modules/4.05-residency/_pdf/expulsionOrderDraft.pdf");
const S = require("./residencyExpulsionOrder.service");

const ID = "64b0000000000000000000a1";
const OFFICE = { _id: "u-office", role: { title: "magistratura_bolim" } };
const ADMIN = { role: { title: "super_admin" } };
const PDF = {
  storageKey: "draft/2026/10/SECRET.pdf",
  fileName: "chetlatish-buyrugi-loyihasi-0000a1-03.10.2026.pdf",
  size: 61234,
  sha256: "b".repeat(64),
  hours: 74,
  templateVersion: 1,
  generatedAt: new Date("2026-10-03T06:00:00Z"),
  generatedBy: "u-office",
  generatedByName: "Karimova Dilnoza",
};
const doc = (extra = {}) => ({
  _id: ID,
  status: "loyiha",
  origin: "tizim",
  resident: { _id: "r1", status: "oquvda", active: true },
  noticesSentAt: new Date("2026-10-14T03:10:05Z"),
  scan: null,
  draftPdf: null,
  history: [],
  ...extra,
});

describe("DTO — `draftPdf` oq ro'yxati", () => {
  test("`storageKey` HECH QACHON chiqmaydi, qolgan metama'lumot chiqadi", () => {
    const dto = S.toOrderDTO(doc({ draftPdf: PDF }), OFFICE);
    expect(JSON.stringify(dto)).not.toMatch(/SECRET|storageKey/);
    expect(dto.draftPdf).toEqual({
      fileName: PDF.fileName,
      size: PDF.size,
      sha256: PDF.sha256,
      hours: 74,
      templateVersion: 1,
      generatedAt: PDF.generatedAt,
      generatedBy: "u-office",
      generatedByName: "Karimova Dilnoza",
    });
  });

  test("PDF yo'q — `null`", () => {
    expect(S.toOrderDTO(doc(), OFFICE).draftPdf).toBeNull();
  });

  test("ro'yxat so'rovi `draftPdf.storageKey` ni olmaydi va muallifni populate qiladi", async () => {
    Order.paginate = jest.fn().mockResolvedValue({ docs: [] });
    await S.paginate({ page: 1, limit: 10 }, OFFICE);
    const [, opts] = Order.paginate.mock.calls[0];
    expect(opts.select.split(" ")).toContain("-draftPdf.storageKey");
    expect(opts.populate).toContainEqual({ path: "draftPdf.generatedBy", select: "firstName lastName middleName" });
  });
});

describe("`canGetDraftPdf` (W-3, W-4, W-5)", () => {
  test.each([
    ["bo'lim, ochiq `tizim`, skansiz", OFFICE, doc(), true],
    ["super_admin — yuklab ololmaydi (W-4=A)", ADMIN, doc({ draftPdf: PDF }), false],
    ["`meros`, PDF yo'q (W-3=A)", OFFICE, doc({ origin: "meros" }), false],
    ["hali e'lon qilinmagan", OFFICE, doc({ noticesSentAt: null }), false],
    ["skan bor, PDF yo'q — yangisi yaratilmaydi (W-5=C)", OFFICE, doc({ scan: { sha256: "a" } }), false],
    ["ta'tildagi rezident", OFFICE, doc({ resident: { status: "akademik_tatil", active: true } }), false],
    ["nofaol rezident", OFFICE, doc({ resident: { status: "oquvda", active: false } }), false],
    ["yopilgan, PDF yo'q", OFFICE, doc({ status: "bekor_qilingan" }), false],
    ["imzolangan, PDF saqlangan — dalil beriladi", OFFICE, doc({ status: "imzolangan", draftPdf: PDF }), true],
    ["skan bor, PDF saqlangan", OFFICE, doc({ scan: { sha256: "a" }, draftPdf: PDF }), true],
  ])("%s", (_label, user, order, expected) => {
    expect(S.toOrderDTO(order, user).canGetDraftPdf).toBe(expected);
  });
});

const NOW = new Date("2026-10-20T06:00:00Z");
const DRAFTED = new Date("2026-10-14T03:10:00Z");
const BYTES = Buffer.from("%PDF-1.3 mine");
const THEIRS = Buffer.from("%PDF-1.3 theirs");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const MINE_KEY = "draft/2026/10/mine.pdf";
const query = (value) => {
  const q = { select: () => q, populate: () => q, lean: jest.fn().mockResolvedValue(value) };
  return q;
};
const openOrder = (extra = {}) =>
  doc({ resident: "r1", countingYear: "2026/2027", draftedAt: DRAFTED, hoursAtDraft: 72, ...extra });
const liveResident = {
  _id: "r1",
  status: "oquvda",
  active: true,
  expulsionOrderCreated: true,
  expulsionOrderCreatedAt: new Date(DRAFTED),
};
const rows = Array.from({ length: 37 }, () => ({ hours: 2 }));
const rejects = (code, reason) =>
  expect.objectContaining({ statusCode: code, meta: expect.objectContaining({ reason }) });
const orders = (...values) => {
  Order.findById = jest.fn();
  values.forEach((v) => Order.findById.mockReturnValueOnce(query(v)));
  Order.findById.mockReturnValue(query(values.at(-1)));
};

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findById = jest.fn(() => ({ select: jest.fn().mockResolvedValue({ _id: "r1" }) }));
  orders(openOrder(), openOrder());
  draftData.loadDraftResident.mockResolvedValue(liveResident);
  draftData.loadDraftRows.mockResolvedValue(rows);
  buildExpulsionDraftPdf.mockResolvedValue(BYTES);
  files.save.mockResolvedValue({ storageKey: MINE_KEY, size: BYTES.length, sha256: sha(BYTES) });
  files.readFile.mockImplementation(async (key) => (key === MINE_KEY ? BYTES : THEIRS));
  attachDraftPdf.mockImplementation(async ({ draftPdf }) => ({ _id: ID, draftPdf: { ...draftPdf, generatedAt: NOW } }));
});

describe("draftPdfForDownload — kirish va saqlangan PDF", () => {
  test("bo'lim emas — 403 bazadan, diskdan va chizishdan OLDIN", async () => {
    await expect(S.draftPdfForDownload(ID, ADMIN, NOW)).rejects.toEqual(rejects(403, "not_office_signer"));
    expect(Order.findById).not.toHaveBeenCalled();
    expect(files.readFile).not.toHaveBeenCalled();
    expect(buildExpulsionDraftPdf).not.toHaveBeenCalled();
  });

  test("saqlangan PDF — qayta yaratilmaydi, bayt sha256 bilan qaytadi", async () => {
    orders(openOrder(), openOrder({ status: "imzolangan", draftPdf: { ...PDF, storageKey: "k", sha256: sha(THEIRS) } }));
    const res = await S.draftPdfForDownload(ID, OFFICE, NOW);
    expect(res.buffer).toBe(THEIRS);
    expect(files.readFile).toHaveBeenCalledWith("k");
    expect(draftData.loadDraftRows).not.toHaveBeenCalled();
    expect(files.save).not.toHaveBeenCalled();
  });

  test("diskda yo'q — 404 `draft_pdf_file_missing` + log; bayt o'zgargan — 500 `draft_pdf_integrity`", async () => {
    orders(openOrder(), openOrder({ draftPdf: { ...PDF, storageKey: "k", sha256: sha(THEIRS) } }));
    files.readFile.mockResolvedValueOnce(null);
    await expect(S.draftPdfForDownload(ID, OFFICE, NOW)).rejects.toEqual(rejects(404, "draft_pdf_file_missing"));
    expect(winston.error).toHaveBeenCalledTimes(1);
    files.readFile.mockResolvedValueOnce(Buffer.concat([THEIRS, Buffer.from("x")]));
    await expect(S.draftPdfForDownload(ID, OFFICE, NOW)).rejects.toEqual(rejects(500, "draft_pdf_integrity"));
    expect(winston.error).toHaveBeenCalledTimes(2);
  });

  test("yopilgan, PDF yo'q — 404 `draft_pdf_missing`, hech narsa yaratilmaydi", async () => {
    orders(openOrder(), openOrder({ status: "bekor_qilingan" }));
    await expect(S.draftPdfForDownload(ID, OFFICE, NOW)).rejects.toEqual(rejects(404, "draft_pdf_missing"));
    expect(draftData.loadDraftResident).not.toHaveBeenCalled();
    expect(files.save).not.toHaveBeenCalled();
  });
});

describe("draftPdfForDownload — yaratish", () => {
  test("bitta `now`: jadval, fayl nomi, CAS; jami = qatorlar yig'indisi", async () => {
    const res = await S.draftPdfForDownload(ID, OFFICE, NOW);
    expect(draftData.loadDraftRows).toHaveBeenCalledWith("r1", NOW);
    expect(draftData.toDraftInput).toHaveBeenCalledWith(
      expect.objectContaining({ total: 74, now: NOW, resident: liveResident }),
    );
    expect(files.save).toHaveBeenCalledWith(BYTES, "pdf", { prefix: "draft" });
    expect(attachDraftPdf).toHaveBeenCalledWith({
      orderId: ID,
      draftPdf: {
        storageKey: MINE_KEY,
        size: BYTES.length,
        sha256: sha(BYTES),
        hours: 74,
        templateVersion: 1,
        fileName: "chetlatish-buyrugi-loyihasi-0000a1-20.10.2026.pdf",
      },
      actor: OFFICE,
      now: NOW,
    });
    expect(res.buffer).toBe(BYTES);
    expect(files.remove).not.toHaveBeenCalled();
  });

  test.each([
    ["rezident o'chirilgan", () => draftData.loadDraftResident.mockResolvedValueOnce(null), 404, "order_not_found"],
    ["`meros`", () => orders(openOrder(), openOrder({ origin: "meros" })), 409, "draft_pdf_not_available"],
    ["soat 71 (72 dan past)", () => draftData.loadDraftRows.mockResolvedValueOnce([...rows.slice(2), { hours: 1 }]), 409, "hours_below_threshold"],
  ])("%s — rad, diskka yozilmaydi", async (_label, arrange, code, reason) => {
    arrange();
    await expect(S.draftPdfForDownload(ID, OFFICE, NOW)).rejects.toEqual(rejects(code, reason));
    expect(buildExpulsionDraftPdf).not.toHaveBeenCalled();
    expect(files.save).not.toHaveBeenCalled();
  });
});

describe("draftPdfForDownload — W-5 va o'qish maydonlari", () => {
  test("skan yuklangan — 409 `scan_already_uploaded`, chizish va disk YO'Q", async () => {
    orders(openOrder(), openOrder({ scan: { sha256: "a" } }));
    await expect(S.draftPdfForDownload(ID, OFFICE, NOW)).rejects.toEqual(rejects(409, "scan_already_uploaded"));
    expect(buildExpulsionDraftPdf).not.toHaveBeenCalled();
    expect(files.save).not.toHaveBeenCalled();
  });

  test("asosiy o'qish qog'ozga kerak maydonlarni oladi (loyiha soati, e'lon, skan)", async () => {
    const selects = [];
    Order.findById = jest.fn(() => {
      const q = { select: (arg) => { selects.push(arg); return q; }, lean: jest.fn().mockResolvedValue(openOrder()) };
      return q;
    });
    await S.draftPdfForDownload(ID, OFFICE, NOW);
    expect(selects[1].split(/\s+/).sort()).toEqual([
      "countingYear", "draftPdf", "draftedAt", "hoursAtDraft", "noticesSentAt", "origin", "resident", "residentName",
      "scan", "status",
    ]);
  });
});

describe("CAS yutqazildi / xato — yetim fayl qolmaydi", () => {
  const theirs = { ...PDF, storageKey: "draft/2026/10/theirs.pdf", sha256: sha(THEIRS) };
  test.each([
    ["g'olib PDF'i — o'sha bayt beriladi", openOrder({ draftPdf: theirs }), null],
    ["shu orada imzolandi", openOrder({ status: "imzolangan" }), [409, "order_not_open"]],
    ["shu orada skan yuklandi (W-5=C)", openOrder({ scan: { sha256: "a" } }), [409, "scan_already_uploaded"]],
    ["buyruq yo'q", null, [404, "order_not_found"]],
  ])("%s", async (_label, after, error) => {
    attachDraftPdf.mockResolvedValueOnce(null);
    orders(openOrder(), openOrder(), after);
    const run = S.draftPdfForDownload(ID, OFFICE, NOW);
    if (error) await expect(run).rejects.toEqual(rejects(...error));
    else expect((await run).buffer).toBe(THEIRS);
    expect(files.remove).toHaveBeenCalledWith(MINE_KEY);
  });

  test("CAS xatosi — fayl HECH QACHON o'chirilmaydi (kalit logda)", async () => {
    attachDraftPdf.mockRejectedValueOnce(new Error("socket closed"));
    orders(openOrder(), openOrder(), openOrder());
    await expect(S.draftPdfForDownload(ID, OFFICE, NOW)).rejects.toThrow("socket closed");
    expect(files.remove).not.toHaveBeenCalled();
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining(MINE_KEY));
  });
});
