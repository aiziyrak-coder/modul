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
const { cancelDraftBelowThreshold, repairPointer } = require("./expulsionOrderLifecycle");
const { signOrder } = require("./expulsionOrderDecision");

const NOW = new Date("2026-10-05T10:00:00Z");
const SHA = "a".repeat(64);
const ACTOR = { _id: "u-office", lastName: "Karimova", firstName: "Nodira" };
const INPUT = { paperOrderNumber: "12-ch", paperOrderDate: "2026-10-03", scanSha256: SHA };

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
const sign = (extra = {}) =>
  signOrder({ orderId: "o1", input: INPUT, actor: ACTOR, countHours: jest.fn().mockResolvedValue(76), now: NOW, ...extra });
const s1 = () => Order.findOneAndUpdate.mock.calls[0];
const s2Calls = () => Resident.updateOne.mock.calls;

beforeEach(() => {
  jest.clearAllMocks();
  stored = draft();
  live = { _id: "r1", status: "oquvda", active: true, user: "u-res", expulsionOrderCreated: true };
  Order.findById = jest.fn(() => query(stored));
  Order.findOneAndUpdate = jest.fn(() => query({ ...stored, status: "imzolangan" }));
  Order.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
  Resident.findOne = jest.fn(() => query(live));
  Resident.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
});

describe("S1 → S2 — aniq filtrlar", () => {
  test("S1: `{_id, scan.sha256, status: loyiha}` — imzolangan skan bo'lim KO'RGAN skan", async () => {
    const res = await sign();
    const [filter, change] = s1();
    expect(filter).toEqual({ _id: "o1", "scan.sha256": SHA, status: "loyiha" });
    expect(change.$set).toMatchObject({
      status: "imzolangan",
      signedAt: NOW,
      signedBy: "u-office",
      signedByName: "Karimova Nodira",
      hoursAtSign: 76,
      paperOrderNumber: "12-ch",
      paperOrderDate: "2026-10-03",
    });
    expect(change.$push.history).toMatchObject({ action: "imzolandi", source: "office", hours: 76 });
    expect(res.flipped).toBe(true);
  });

  test("S2: faqat `{_id, status: {$ne: chetlatilgan}}`, bayroq SHU yozuvda tozalanadi", async () => {
    await sign();
    expect(s2Calls()[0]).toEqual([
      { _id: "r1", status: { $ne: "chetlatilgan" } },
      { $set: { status: "chetlatilgan", expulsionOrderCreated: false, expulsionOrderCreatedAt: null } },
    ]);
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: "o1", status: "imzolangan", residentAppliedAt: null },
      { $set: { residentAppliedAt: NOW } },
    );
    expect(s1()).toBeDefined();
    expect(Order.findOneAndUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      Resident.updateOne.mock.invocationCallOrder[0],
    );
    expect(revokeExpulsionNotice).toHaveBeenCalledWith("r1");
    expect(revokeLegacyExpulsionNotice).not.toHaveBeenCalled();
  });

  test("S2 hech narsa o'zgartirmadi (parallel yakunlash) — `flipped: false`", async () => {
    Resident.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await sign()).flipped).toBe(false);
  });

});

describe("S1 yozuvi — dalil va eslatmalar", () => {
  test("ERI dalili FAQAT `eri` argumentidan; yo'q bo'lsa — `null`", async () => {
    await sign();
    expect(s1()[1].$set).toMatchObject({ eriSerialNumber: null, eriSubject: null, eriSignedAt: null });
    jest.clearAllMocks();
    const at = new Date("2026-10-05T09:59:00Z");
    await sign({ eri: { serialNumber: "7A1F", cert: { subject: "CN=Karimova" }, signedAt: at } });
    expect(s1()[1].$set).toMatchObject({ eriSerialNumber: "7A1F", eriSubject: "CN=Karimova", eriSignedAt: at });
  });

  test("`meros` — P3 dan oldingi eslatma ham olinadi", async () => {
    stored = draft({ origin: "meros" });
    await sign();
    expect(revokeLegacyExpulsionNotice).toHaveBeenCalledWith("u-res");
  });
});

describe("S1 dan oldin ko'rsatkich", () => {
  test("bayroq yo'q — `repairPointer` S1 dan OLDIN", async () => {
    live = { ...live, expulsionOrderCreated: false };
    await sign();
    expect(repairPointer).toHaveBeenCalledWith("r1");
    expect(repairPointer.mock.invocationCallOrder[0]).toBeLessThan(Order.findOneAndUpdate.mock.invocationCallOrder[0]);
  });

  test("bayroq bor — ta'mir chaqirilmaydi", async () => {
    await sign();
    expect(repairPointer).not.toHaveBeenCalled();
  });
});

describe("yarim imzoni yakunlash (qayta yuborish)", () => {
  const signed = (extra = {}) =>
    draft({ status: "imzolangan", paperOrderNumber: "12-ch", paperOrderDate: "2026-10-03", ...extra });

  test("AYNAN o'sha so'rov — S1 yo'q, faqat S2", async () => {
    stored = signed();
    const res = await sign();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(s2Calls()[0][0]).toEqual({ _id: "r1", status: { $ne: "chetlatilgan" } });
    expect(res.flipped).toBe(true);
  });

  test.each([
    ["boshqa raqam", { paperOrderNumber: "13-ch" }],
    ["boshqa sana", { paperOrderDate: "2026-10-02" }],
    ["boshqa skan", { scan: { sha256: "b".repeat(64) } }],
  ])("%s — 409 `order_not_open`, S2 YO'Q", async (_label, extra) => {
    stored = signed(extra);
    await expect(sign()).rejects.toMatchObject({
      statusCode: 409,
      meta: { reason: "order_not_open", currentStatus: "imzolangan" },
    });
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });
});

describe("S1 yutqazildi — yon ta'sir YO'Q", () => {
  test.each([
    ["hujjat hamon loyiha (skan almashdi)", "loyiha", "scan_changed"],
    ["boshqa qaror yutdi", "rad_etilgan", "order_not_open"],
  ])("%s → %s", async (_label, nowStatus, reason) => {
    Order.findOneAndUpdate = jest.fn(() => query(null));
    Order.findById = jest
      .fn()
      .mockReturnValueOnce(query(stored))
      .mockReturnValue(query({ status: nowStatus }));
    await expect(sign()).rejects.toMatchObject({ statusCode: 409, meta: { reason } });
    expect(Resident.updateOne).not.toHaveBeenCalled();
    expect(revokeExpulsionNotice).not.toHaveBeenCalled();
  });
});
