jest.mock("./residencyExpulsionOrder.model");
jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  canAccessResident: jest.fn(() => true),
  deletedResidentIds: jest.fn().mockResolvedValue(["gone"]),
  residentIdsFor: jest.fn().mockResolvedValue(null),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOrderDecision", () => ({
  ...jest.requireActual("#modules/4.05-residency/_services/expulsionOrderDecision"),
  signOrder: jest.fn(),
  rejectOrder: jest.fn(),
  attachScan: jest.fn(),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOfficeNotices", () => ({
  deliverDecision: jest.fn().mockResolvedValue(true),
}));
jest.mock("#modules/4.05-residency/_services/expulsionCheck", () => ({ countUnexcusedHours: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/expulsionOrderFiles", () => ({
  detectScanType: jest.fn(() => ({ mimeType: "application/pdf", ext: "pdf" })),
  save: jest.fn().mockResolvedValue({ storageKey: "2026/10/k.pdf", size: 9, sha256: "a".repeat(64) }),
  remove: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn(),
  createReadStream: jest.fn(),
}));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Order = require("./residencyExpulsionOrder.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { residentIdsFor, canAccessResident } = require("#modules/4.05-residency/_services/residentScope");
const { signOrder, rejectOrder, attachScan } = require("#modules/4.05-residency/_services/expulsionOrderDecision");
const { deliverDecision } = require("#modules/4.05-residency/_services/expulsionOfficeNotices");
const files = require("#modules/4.05-residency/_services/expulsionOrderFiles");
const S = require("./residencyExpulsionOrder.service");

const ID = "64b0000000000000000000a1";
const OFFICE = { _id: "u-office", role: { title: "magistratura_bolim" } };
const BODY = { orderId: ID, paperOrderNumber: "12-ch", paperOrderDate: "2026-10-03", scanSha256: "a".repeat(64) };
const query = (value) => {
  const q = { select: () => q, populate: () => q, lean: jest.fn().mockResolvedValue(value) };
  return q;
};
const doc = (extra = {}) => ({
  _id: ID,
  status: "loyiha",
  origin: "tizim",
  resident: { _id: "r1", status: "oquvda", active: true },
  scan: { storageKey: "SECRET", sha256: "a".repeat(64), fileName: "b.pdf" },
  eriSubject: "CN=Karimova, PINFL=1234",
  deliveries: { signed: null },
  history: [],
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  Order.findById = jest.fn(() => query(doc()));
  Resident.findById = jest.fn(() => ({ select: jest.fn().mockResolvedValue({ _id: "r1" }) }));
  signOrder.mockResolvedValue({ order: doc({ status: "imzolangan" }), flipped: true });
  rejectOrder.mockResolvedValue({ order: doc({ status: "rad_etilgan" }) });
  attachScan.mockResolvedValue(doc());
});

describe("U-2=A — faqat bo'lim xodimi qaror qiladi (403 diskdan va o'tishdan OLDIN)", () => {
  test.each([
    ["super_admin", { role: { title: "super_admin" } }],
    ["admin", { role: { title: "admin" } }],
    ["klinik_ustoz", { role: { title: "klinik_ustoz" } }],
    ["rolsiz", {}],
  ])("%s → 403 `not_office_signer`", async (_label, user) => {
    const denied = expect.objectContaining({ statusCode: 403, meta: { reason: "not_office_signer" } });
    await expect(S.sign(ID, BODY, undefined, user)).rejects.toEqual(denied);
    await expect(S.reject(ID, { orderId: ID, reason: "x" }, user)).rejects.toEqual(denied);
    await expect(S.uploadScan(ID, { buffer: Buffer.from("x") }, user)).rejects.toEqual(denied);
    await expect(S.scanForDownload(ID, user)).rejects.toEqual(denied);
    expect(signOrder).not.toHaveBeenCalled();
    expect(rejectOrder).not.toHaveBeenCalled();
    expect(files.save).not.toHaveBeenCalled();
    expect(Order.findById).not.toHaveBeenCalled();
  });

  test("`orderId` yo'ldagi `:id` ga mos emas — 400 `binding_mismatch`", async () => {
    await expect(S.sign(ID, { ...BODY, orderId: "64b0000000000000000000ff" }, undefined, OFFICE)).rejects.toEqual(
      expect.objectContaining({ statusCode: 400, meta: { reason: "binding_mismatch" } }),
    );
    expect(signOrder).not.toHaveBeenCalled();
  });

  test("o'chirilgan / doiradan tashqari rezident — 404", async () => {
    Resident.findById = jest.fn(() => ({ select: jest.fn().mockResolvedValue(null) }));
    await expect(S.sign(ID, BODY, undefined, OFFICE)).rejects.toEqual(expect.objectContaining({ statusCode: 404 }));
  });
});

describe("imzo / rad — ulanish", () => {
  test("imzo: faqat to'rt qog'oz maydoni, `req.eri` va jonli hisob uzatiladi; U-6 — `flipped` da", async () => {
    await S.sign(ID, { ...BODY, eriSignature: "SIG" }, { serialNumber: "7A" }, OFFICE);
    expect(signOrder).toHaveBeenCalledWith({
      orderId: ID,
      input: { paperOrderNumber: "12-ch", paperOrderDate: "2026-10-03", scanSha256: "a".repeat(64) },
      eri: { serialNumber: "7A" },
      actor: OFFICE,
      countHours: expect.any(Function),
    });
    expect(deliverDecision).toHaveBeenCalledWith(expect.objectContaining({ status: "imzolangan" }), "signed");
  });

  test("imzo `flipped: false` — U-6 YO'Q", async () => {
    signOrder.mockResolvedValueOnce({ order: doc({ status: "imzolangan" }), flipped: false });
    await S.sign(ID, BODY, undefined, OFFICE);
    expect(deliverDecision).not.toHaveBeenCalled();
  });

  test("xabar xatosi javobni YIQITMAYDI (qaror allaqachon yozilgan)", async () => {
    deliverDecision.mockRejectedValueOnce(new Error("Mongo down"));
    await expect(S.reject(ID, { orderId: ID, reason: "Sababli" }, OFFICE)).resolves.toMatchObject({ _id: ID });
    expect(deliverDecision).toHaveBeenCalledWith(expect.anything(), "rejected");
  });
});

describe("DTO — oq ro'yxat va bayroqlar", () => {
  test("`storageKey`, `eriSubject`, `deliveries` HECH QACHON chiqmaydi", async () => {
    const dto = await S.findOne(ID, OFFICE);
    expect(JSON.stringify(dto)).not.toMatch(/SECRET|storageKey|eriSubject|PINFL|deliveries/);
    expect(dto.scan).toMatchObject({ fileName: "b.pdf", sha256: "a".repeat(64) });
  });

  test.each([
    ["bo'lim, ochiq, skan bor", OFFICE, doc(), { canUploadScan: true, canReject: true, canSign: true, needsResume: false }],
    ["super_admin — hamma qaror bayrog'i false", { role: { title: "super_admin" } }, doc(), { canUploadScan: false, canReject: false, canSign: false }],
    ["skansiz — imzo yo'q", OFFICE, doc({ scan: null }), { canSign: false, canReject: true }],
    ["ta'tildagi `tizim` — imzo yo'q", OFFICE, doc({ resident: { status: "akademik_tatil" } }), { canSign: false }],
    ["yarim imzo", OFFICE, doc({ status: "imzolangan", residentAppliedAt: null }), { needsResume: true, canResume: true, canSign: false }],
    ["tugallangan imzo", OFFICE, doc({ status: "imzolangan", residentAppliedAt: new Date(), resident: { status: "chetlatilgan" } }), { needsResume: false }],
  ])("%s", (_label, user, order, flags) => {
    expect(S.toOrderDTO(order, user)).toMatchObject(flags);
  });

  test("ro'yxat: o'chirilganlar chiqariladi, doira bilan kesishadi, yangisi birinchi", async () => {
    residentIdsFor.mockResolvedValueOnce(["r1", "r2"]);
    Order.paginate = jest.fn().mockResolvedValue({ docs: [doc()], totalDocs: 1 });
    const res = await S.paginate({ page: "1", limit: "10", status: "loyiha" }, { role: { title: "kafedra_mudiri" } });
    const [filter, opts] = Order.paginate.mock.calls[0];
    expect(filter).toEqual({ resident: { $nin: ["gone"], $in: ["r1", "r2"] }, status: "loyiha" });
    expect(opts).toMatchObject({ page: 1, limit: 10, sort: { draftedAt: -1, _id: -1 }, lean: true });
    expect(opts.select).toContain("-scan.storageKey");
    expect(JSON.stringify(res.docs)).not.toContain("SECRET");
  });
});

describe("skan yuklash", () => {
  const file = { buffer: Buffer.from("%PDF-x"), originalname: "buyruq.pdf" };

  test("tur mos emas — 400, diskka YOZILMAYDI", async () => {
    files.detectScanType.mockReturnValueOnce(null);
    await expect(S.uploadScan(ID, file, OFFICE)).rejects.toEqual(
      expect.objectContaining({ statusCode: 400, meta: { reason: "SCAN_TYPE_NOT_ALLOWED" } }),
    );
    expect(files.save).not.toHaveBeenCalled();
  });

  test("hujjat loyiha emas — 409 diskka yozishdan OLDIN", async () => {
    Order.findById = jest.fn(() => query(doc({ status: "imzolangan" })));
    await expect(S.uploadScan(ID, file, OFFICE)).rejects.toEqual(expect.objectContaining({ statusCode: 409 }));
    expect(files.save).not.toHaveBeenCalled();
  });

  test("CAS yutqazildi (shu orada imzolandi) — blob o'chiriladi, 409", async () => {
    attachScan.mockResolvedValueOnce(null);
    Order.findById = jest.fn().mockReturnValueOnce(query(doc())).mockReturnValue(query(doc({ status: "imzolangan" })));
    await expect(S.uploadScan(ID, file, OFFICE)).rejects.toEqual(expect.objectContaining({ statusCode: 409 }));
    expect(files.remove).toHaveBeenCalledWith("2026/10/k.pdf");
  });

  test("tur va kengaytma BAYTDAN, nom faqat ko'rsatish uchun", async () => {
    await S.uploadScan(ID, { ...file, originalname: "../../x.exe" }, OFFICE);
    const { scan } = attachScan.mock.calls[0][0];
    expect(files.save).toHaveBeenCalledWith(file.buffer, "pdf");
    expect(scan).toMatchObject({ storageKey: "2026/10/k.pdf", mimeType: "application/pdf", fileName: "....x.pdf" });
  });
});

describe("ko'rik (P6a-2) — doira, bayroqlar, skan chekkalari", () => {
  test("doiradan tashqari rezident — 404 (`canAccessResident`)", async () => {
    canAccessResident.mockReturnValueOnce(false);
    await expect(S.findOne(ID, OFFICE)).rejects.toEqual(expect.objectContaining({ statusCode: 404 }));
  });

  test("`?resident=` ruxsat etilgan ro'yxatni KENGAYTIRMAYDI", async () => {
    residentIdsFor.mockResolvedValueOnce(["r1"]);
    Order.paginate = jest.fn().mockResolvedValue({ docs: [] });
    await S.paginate({ page: 1, limit: 10, resident: "r9" }, { role: { title: "kafedra_mudiri" } });
    expect(Order.paginate.mock.calls[0][0].resident).toEqual({ $nin: ["gone"], $in: [] });
  });

  test.each([
    ["nofaol rezident — rad etib ham bo'lmaydi", OFFICE, doc({ resident: { status: "oquvda", active: false } }), { canReject: false, canSign: false }],
    ["bo'lim emas — yakunlash tugmasi yo'q", { role: { title: "super_admin" } }, doc({ status: "imzolangan", residentAppliedAt: null }), { needsResume: true, canResume: false }],
  ])("%s", (_label, user, order, flags) => {
    expect(S.toOrderDTO(order, user)).toMatchObject(flags);
  });

  test("skan yuklanmagan — 404 `scan_missing`; diskda yo'q — 404 `scan_file_missing`", async () => {
    Order.findById = jest.fn(() => query(doc({ scan: null })));
    await expect(S.scanForDownload(ID, OFFICE)).rejects.toEqual(
      expect.objectContaining({ statusCode: 404, meta: { reason: "scan_missing" } }),
    );
    Order.findById = jest.fn(() => query(doc()));
    files.stat.mockResolvedValueOnce(null);
    await expect(S.scanForDownload(ID, OFFICE)).rejects.toEqual(
      expect.objectContaining({ statusCode: 404, meta: { reason: "scan_file_missing" } }),
    );
  });

  test("biriktirishda baza xatosi — blob o'chiriladi, xato yuqoriga", async () => {
    attachScan.mockRejectedValueOnce(new Error("Mongo down"));
    await expect(S.uploadScan(ID, { buffer: Buffer.from("%PDF-x"), originalname: "b.pdf" }, OFFICE)).rejects.toThrow("Mongo down");
    expect(files.remove).toHaveBeenCalledWith("2026/10/k.pdf");
  });
});

describe("biriktirish xatosi — blob faqat bog'lanmagan bo'lsa o'chadi", () => {
  const file = { buffer: Buffer.from("%PDF-x"), originalname: "b.pdf" };
  test.each([
    ["hujjat shu blob'ga ko'rsatadi — qoladi", () => query(doc({ scan: { storageKey: "2026/10/k.pdf" } })), false],
    ["hujjat boshqa blob'da — o'chiriladi", () => query(doc({ scan: { storageKey: "old.pdf" } })), true],
  ])("%s", async (_label, afterFail, removed) => {
    attachScan.mockRejectedValueOnce(new Error("socket closed"));
    Order.findById = jest.fn().mockReturnValueOnce(query(doc())).mockImplementation(afterFail);
    await expect(S.uploadScan(ID, file, OFFICE)).rejects.toThrow("socket closed");
    expect(files.remove).toHaveBeenCalledTimes(removed ? 1 : 0);
  });

  test("tekshirib bo'lmadi — blob qoladi (yetim fayl dalil yo'qolishidan arzon)", async () => {
    attachScan.mockRejectedValueOnce(new Error("socket closed"));
    Order.findById = jest.fn().mockReturnValueOnce(query(doc())).mockImplementation(() => {
      throw new Error("Mongo down");
    });
    await expect(S.uploadScan(ID, file, OFFICE)).rejects.toThrow("socket closed");
    expect(files.remove).not.toHaveBeenCalled();
  });
});
