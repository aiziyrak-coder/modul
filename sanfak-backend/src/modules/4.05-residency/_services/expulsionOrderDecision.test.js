jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
jest.mock("./expulsionReversal", () => ({
  revokeExpulsionNotice: jest.fn().mockResolvedValue(0),
  revokeExpulsionNoticeInBackground: jest.fn(),
  revokeNoticesWithoutOpenDraft: jest.fn().mockResolvedValue(0),
  revokeLegacyExpulsionNotice: jest.fn().mockResolvedValue(0),
  countOrderNotices: jest.fn().mockResolvedValue(1),
}));
jest.mock("./expulsionOrderLifecycle", () => ({
  ...jest.requireActual("./expulsionOrderLifecycle"),
  cancelDraftBelowThreshold: jest.fn().mockResolvedValue(undefined),
  clearStalePointer: jest.fn().mockResolvedValue(undefined),
  repairPointer: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { revokeExpulsionNotice, revokeLegacyExpulsionNotice } = require("./expulsionReversal");
const { cancelDraftBelowThreshold, clearStalePointer } = require("./expulsionOrderLifecycle");
const {
  signOrder,
  rejectOrder,
  attachScan,
  assertScanAccepted,
  markSignedBasisLost,
  _isRealDate,
} = require("./expulsionOrderDecision");

const NOW = new Date("2026-10-05T10:00:00Z");
const SHA = "a".repeat(64);
const ACTOR = { _id: "u-office", lastName: "Karimova", firstName: "Nodira" };

const query = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});
let stored;
let live;
const draft = (extra = {}) => ({
  _id: "o1",
  resident: "r1",
  origin: "tizim",
  status: "loyiha",
  draftedAt: new Date("2026-10-01T08:00:00Z"),
  scan: { sha256: SHA },
  history: [],
  ...extra,
});
const sign = ({ date = "2026-10-03", sha = SHA, hours = 76, now = NOW } = {}) =>
  signOrder({
    orderId: "o1",
    input: { paperOrderNumber: "12-ch", paperOrderDate: date, scanSha256: sha },
    actor: ACTOR,
    countHours: jest.fn().mockResolvedValue(hours),
    now,
  });
const rejects = (reason, code = 409) =>
  expect.objectContaining({ statusCode: code, meta: expect.objectContaining({ reason }) });

beforeEach(() => {
  jest.clearAllMocks();
  stored = draft();
  live = { _id: "r1", status: "oquvda", active: true, user: "u-res" };
  Order.findById = jest.fn(() => query(stored));
  Order.findOneAndUpdate = jest.fn(() => query({ ...stored, status: "imzolangan" }));
  Order.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
  Resident.findOne = jest.fn(() => query(live));
  Resident.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
  Order.exists = jest.fn().mockResolvedValue({ _id: "o1" });
});

describe("imzo — qog'oz sanasi", () => {
  test.each([
    ["mavjud bo'lmagan kun", "2026-02-30"],
    ["kelajak (UZ bo'yicha ertaga)", "2026-10-06"],
    ["loyihadan oldin", "2026-09-30"],
    ["format", "2026-10-3"],
  ])("%s → 400 `paper_date_invalid`, hech narsa yozilmaydi", async (_label, date) => {
    await expect(sign({ date })).rejects.toEqual(rejects("paper_date_invalid", 400));
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("loyiha kunidan oldingi sana — UZ bo'yicha (UTC da bir kun bo'lsa ham)", async () => {
    stored = draft({ draftedAt: new Date("2026-10-01T20:00:00Z") });
    await expect(sign({ date: "2026-10-01" })).rejects.toEqual(rejects("paper_date_invalid", 400));
    await expect(sign({ date: "2026-10-02" })).resolves.toBeDefined();
  });

  test("chegara UZ kuni bo'yicha", async () => {
    await expect(sign({ date: "2026-10-06", now: new Date("2026-10-05T20:00:00Z") })).resolves.toBeDefined();
  });

  test("`meros`: quyi chegara `draftedAt` emas, umumiy MIN_DATE", async () => {
    stored = draft({ origin: "meros" });
    await expect(sign({ date: "2025-01-15" })).resolves.toBeDefined();
    await expect(sign({ date: "1999-12-31" })).rejects.toEqual(rejects("paper_date_invalid", 400));
  });

  test.each([
    ["2026-02-28", true],
    ["2028-02-29", true],
    ["2026-02-29", false],
    ["2026-13-01", false],
    [undefined, false],
  ])("_isRealDate(%s) → %s", (value, expected) => {
    expect(_isRealDate(value)).toBe(expected);
  });
});

describe("imzo — skan va rezident", () => {
  test("skan yo'q → 409 `scan_missing`; boshqa sha → 409 `scan_changed`", async () => {
    stored = draft({ scan: null });
    await expect(sign()).rejects.toEqual(rejects("scan_missing"));
    stored = draft();
    await expect(sign({ sha: "b".repeat(64) })).rejects.toEqual(rejects("scan_changed"));
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ["tizim", "akademik_tatil", "resident_not_signable"],
    ["tizim", "chetlatilgan", "resident_not_signable"],
    ["meros", "chetlatilgan", "resident_not_signable"],
  ])("%s + %s → 409 `%s`", async (origin, status, reason) => {
    stored = draft({ origin });
    live = { ...live, status };
    await expect(sign()).rejects.toEqual(rejects(reason));
  });

  test("V-1=B: `meros` + ta'til — imzolanadi; `status` yo'q (backfill'gacha) — ham", async () => {
    stored = draft({ origin: "meros" });
    live = { ...live, status: "akademik_tatil" };
    await expect(sign()).resolves.toBeDefined();
    stored = draft();
    live = { _id: "r1", active: true };
    await expect(sign()).resolves.toBeDefined();
  });

  test("`active: false` → 409 `resident_inactive`", async () => {
    live = { ...live, active: false };
    await expect(sign()).rejects.toEqual(rejects("resident_inactive"));
  });

  test("hujjat loyiha emas → 409 `order_not_open` (soat hisoblanmaydi)", async () => {
    stored = draft({ status: "bekor_qilingan" });
    await expect(sign()).rejects.toEqual(rejects("order_not_open"));
    expect(Resident.findOne).toHaveBeenCalled();
  });
});

describe("imzo — imzo paytidagi soat", () => {
  test("`tizim` 71 soat — tizim bekor qilishi (surat bilan, kutib) + 409, S1 YO'Q", async () => {
    await expect(sign({ hours: 71 })).rejects.toEqual(rejects("hours_below_threshold"));
    expect(cancelDraftBelowThreshold).toHaveBeenCalledWith(live, {
      hours: 71,
      source: "office",
      now: NOW,
      awaitRevoke: true,
    });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("ko'rsatkichsiz `tizim` 71 soat — bekor qilish TIKLANGAN surat bilan", async () => {
    const { repairPointer } = require("./expulsionOrderLifecycle");
    live = { _id: "r1", status: "oquvda", active: true, expulsionOrderCreated: false };
    const repaired = { ...live, expulsionOrderCreated: true, expulsionOrderCreatedAt: new Date("2026-10-01T08:00:00Z") };
    Resident.findOne = jest.fn().mockReturnValueOnce(query(live)).mockReturnValue(query(repaired));
    await expect(sign({ hours: 71 })).rejects.toEqual(rejects("hours_below_threshold"));
    expect(repairPointer).toHaveBeenCalledWith("r1");
    expect(cancelDraftBelowThreshold.mock.calls[0][0]).toBe(repaired);
  });

  test("`meros` 10 soat — imzolanadi (U-5=A), soat yoziladi", async () => {
    stored = draft({ origin: "meros" });
    await sign({ hours: 10 });
    expect(cancelDraftBelowThreshold).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate.mock.calls[0][1].$set.hoursAtSign).toBe(10);
  });

  test("soat hisoblanmadi (NaN) — 500, hech narsa yozilmaydi va bekor QILINMAYDI", async () => {
    await expect(sign({ hours: NaN })).rejects.toEqual(rejects("hours_unavailable", 500));
    expect(cancelDraftBelowThreshold).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("rad etish (U-3=B)", () => {
  const reject = (hours = 74) =>
    rejectOrder({ orderId: "o1", reason: "Sababli deb topildi", actor: ACTOR, countHours: jest.fn().mockResolvedValue(hours), now: NOW });

  test("CAS `loyiha → rad_etilgan`; jonli soat — belgi chizig'i; bayroq va xabarlar tozalanadi", async () => {
    Order.findOneAndUpdate = jest.fn(() => query({ ...stored, status: "rad_etilgan" }));
    await reject();
    const [filter, change] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: "o1", status: "loyiha" });
    expect(change.$set).toMatchObject({
      status: "rad_etilgan",
      closedAt: NOW,
      closedBy: "u-office",
      closeReason: null,
      closeNote: "Sababli deb topildi",
      hoursAtClose: 74,
    });
    expect(change.$push.history).toMatchObject({ action: "rad_etildi", source: "office", hours: 74 });
    expect(clearStalePointer).toHaveBeenCalledWith("r1");
    expect(revokeExpulsionNotice).toHaveBeenCalledWith("r1");
  });

  test("yutqazgan (shu orada imzolandi) — 409, yon ta'sir YO'Q", async () => {
    Order.findOneAndUpdate = jest.fn(() => query(null));
    Order.findById = jest.fn().mockReturnValueOnce(query(stored)).mockReturnValue(query({ status: "imzolangan" }));
    await expect(reject()).rejects.toEqual(rejects("order_not_open"));
    expect(clearStalePointer).not.toHaveBeenCalled();
    expect(revokeExpulsionNotice).not.toHaveBeenCalled();
  });

  test("soat hisoblanmadi — 500, CAS yo'q; loyiha emas — 409", async () => {
    await expect(reject(NaN)).rejects.toEqual(rejects("hours_unavailable", 500));
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    stored = draft({ status: "imzolangan" });
    await expect(reject()).rejects.toEqual(rejects("order_not_open"));
  });

  test("nofaol rezident — 409 `resident_inactive`, CAS yo'q", async () => {
    live = { ...live, active: false };
    await expect(reject()).rejects.toEqual(rejects("resident_inactive"));
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("`meros` — P3 dan oldingi eslatma ham olinadi", async () => {
    stored = draft({ origin: "meros" });
    Order.findOneAndUpdate = jest.fn(() => query({ ...stored, status: "rad_etilgan" }));
    await reject();
    expect(revokeLegacyExpulsionNotice).toHaveBeenCalledWith("u-res");
  });
});

describe("skan", () => {
  test("`attachScan` — faqat ochiq va chegarasi to'lmagan hujjatga; tarixda sha256", async () => {
    const scan = { storageKey: "2026/10/x.pdf", fileName: "b.pdf", mimeType: "application/pdf", size: 9, sha256: SHA };
    await attachScan({ orderId: "o1", scan, actor: ACTOR, now: NOW });
    const [filter, change] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: "o1", status: "loyiha", "history.29": { $exists: false } });
    expect(change.$set.scan).toEqual({ ...scan, uploadedBy: "u-office", uploadedByName: "Karimova Nodira", uploadedAt: NOW });
    expect(change.$push.history).toMatchObject({ action: "skan_yuklandi", source: "office", note: `sha256 ${SHA}` });
  });

  test("`assertScanAccepted` — loyiha emas → 409; chegara → 409 `scan_limit`", () => {
    expect(() => assertScanAccepted(draft({ status: "imzolangan" }))).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => assertScanAccepted(draft({ history: new Array(30).fill({}) }))).toThrow(
      expect.objectContaining({ meta: { reason: "scan_limit" } }),
    );
    expect(() => assertScanAccepted(draft({ history: new Array(29).fill({}) }))).not.toThrow();
  });
});

describe("markSignedBasisLost — U-7=B (bir marta, holat o'zgarmaydi)", () => {
  const claim = (hours) =>
    markSignedBasisLost({ residentId: "r1", source: "application", countHours: jest.fn().mockResolvedValue(hours), now: NOW });

  test("aniq filtr: imzolangan, da'vosiz, imzoda 72+, JORIY o'quv yilida imzolangan", async () => {
    Order.findOneAndUpdate = jest.fn(() => query({ _id: "o1" }));
    expect(await claim(40)).toEqual({ order: { _id: "o1" }, hours: 40 });
    const [filter, change] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({
      resident: "r1",
      status: "imzolangan",
      basisLostAt: null,
      hoursAtSign: { $gte: 72 },
      signedAt: { $gte: new Date("2026-09-01T00:00:00.000Z") },
    });
    expect(change).toEqual({
      $set: { basisLostAt: NOW, hoursAtBasisLost: 40 },
      $push: { history: { at: NOW, action: "asos_72_dan_past", source: "application", hours: 40 } },
    });
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });

  test.each([72, 90, NaN])("jonli soat %s — da'vo YO'Q", async (hours) => {
    expect(await claim(hours)).toBeNull();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("da'vo qilinadigan buyruq yo'q — qayta hisob ham, CAS ham YO'Q", async () => {
    Order.exists = jest.fn().mockResolvedValue(null);
    const countHours = jest.fn().mockResolvedValue(40);
    expect(await markSignedBasisLost({ residentId: "r1", source: "cron", countHours, now: NOW })).toBeNull();
    expect(Order.exists).toHaveBeenCalledWith(expect.objectContaining({ resident: "r1", status: "imzolangan", basisLostAt: null }));
    expect(countHours).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("CAS yutqazildi (allaqachon da'vo qilingan) — `null`", async () => {
    Order.findOneAndUpdate = jest.fn(() => query(null));
    expect(await claim(40)).toBeNull();
  });
});
