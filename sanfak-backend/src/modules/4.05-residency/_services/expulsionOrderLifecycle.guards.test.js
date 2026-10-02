jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
jest.mock("./expulsionReversal", () => ({
  revokeExpulsionNotice: jest.fn().mockResolvedValue(0),
  revokeExpulsionNoticeInBackground: jest.fn(),
  revokeNoticesWithoutOpenDraft: jest.fn().mockResolvedValue(0),
  countOrderNotices: jest.fn().mockResolvedValue(1),
}));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { revokeExpulsionNotice, revokeExpulsionNoticeInBackground } = require("./expulsionReversal");
const winston = require("#shared/winston.logger");
const {
  openDraft,
  cancelDraftBelowThreshold,
  reconcileDrafts,
  watermarkApplies,
  clearStalePointer,
  isDraftOpen,
} = require("./expulsionOrderLifecycle");

const NOW = new Date("2026-10-05T10:00:00Z");
const T0 = new Date("2026-09-20T08:00:00Z");
const LAST_YEAR = new Date("2026-05-10T08:00:00Z");
const CLEAR = { $set: { expulsionOrderCreated: false, expulsionOrderCreatedAt: null } };

const chain = (value) => {
  const q = {
    sort: jest.fn(() => q),
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
  };
  return q;
};

let db;
const val = (v) => (typeof v === "function" ? v() : v);
const byStatus = (q) => {
  const s = q?.status;
  if (s === "loyiha") return val(db.open);
  if (s === "imzolangan") return val(db.signed);
  if (s === "rad_etilgan") return val(db.rejected);
  return val(db.held);
};

const args = (overrides = {}) => ({
  residentId: "r1",
  residentName: "Valiyev Ali",
  source: "cron",
  countHours: jest.fn().mockResolvedValue(76),
  now: NOW,
  ...overrides,
});
const pointerWrites = () =>
  Resident.updateOne.mock.calls.filter(([, change]) => change.$set?.expulsionOrderCreated === true);

beforeEach(() => {
  jest.clearAllMocks();
  db = { open: null, signed: null, rejected: null, held: null, resident: { status: "oquvda", active: true } };
  Resident.findOne = jest.fn(() => chain(val(db.resident)));
  Resident.updateOne = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  Order.exists = jest.fn(async (q) => byStatus(q));
  Order.findOne = jest.fn((q) => chain(byStatus(q)));
  Order.create = jest.fn().mockResolvedValue({ _id: "order1" });
  Order.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
  Order.findOneAndUpdate = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue({ _id: "o1" }),
  });
  Order.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
});

describe("openDraft — imzolangan buyruq", () => {
  test("imzolangan buyruq bor — hisob ham, hujjat ham YO'Q", async () => {
    db.signed = { _id: "s1" };
    const a = args();
    expect(await openDraft(a)).toEqual({ opened: false, reason: "signed_order" });
    expect(a.countHours).not.toHaveBeenCalled();
    expect(Order.create).not.toHaveBeenCalled();
  });

  test("`create` dan keyin imzo ko'rindi — o'z hujjati qaytariladi, ko'rsatkich YOZILMAYDI", async () => {
    let calls = 0;
    db.signed = () => (calls++ === 0 ? null : { _id: "s1" });
    expect(await openDraft(args())).toEqual({ opened: false, reason: "signed_order" });
    expect(Order.deleteOne).toHaveBeenCalledWith({
      _id: "order1",
      status: "loyiha",
      "history.1": { $exists: false },
    });
    expect(pointerWrites()).toHaveLength(0);
    expect(Resident.updateOne).toHaveBeenCalledWith(
      { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: NOW },
      CLEAR,
    );
  });
});

test("create'dan keyingi jonli soat `hoursAtDraft` ga yoziladi — qarordan OLDIN", async () => {
  db.signed = () => null;
  const a = args({ countHours: jest.fn().mockResolvedValueOnce(80).mockResolvedValue(76) });
  db.rejected = () => (a.countHours.mock.calls.length < 2 ? null : { closedAt: new Date("2026-10-05T09:00:00Z"), hoursAtClose: 76 });
  expect(await openDraft(a)).toEqual({ opened: false, reason: "reject_watermark" });
  expect(Order.updateOne).toHaveBeenCalledWith({ _id: "order1", status: "loyiha" }, { $set: { hoursAtDraft: 76 } });
  expect(Order.updateOne.mock.invocationCallOrder[0]).toBeLessThan(Order.deleteOne.mock.invocationCallOrder[0]);
});

describe("openDraft — rad etish belgi chizig'i (U-3)", () => {
  const rejectedAt = (closedAt, hoursAtClose, countingYear = "2026/2027") => ({
    closedAt,
    hoursAtClose,
    countingYear,
  });

  test("soat rad etilgandagiga TENG — ochilmaydi, eskirgan bayroq tozalanadi", async () => {
    db.rejected = rejectedAt(new Date("2026-10-01T09:00:00Z"), 76);
    db.resident = { status: "oquvda", active: true, expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 };
    expect(await openDraft(args())).toEqual({ opened: false, reason: "reject_watermark" });
    expect(Order.create).not.toHaveBeenCalled();
    expect(Resident.updateOne).toHaveBeenCalledWith(
      { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 },
      CLEAR,
    );
  });

  test("soat rad etilgandan +1 — ochiladi", async () => {
    db.rejected = rejectedAt(new Date("2026-10-01T09:00:00Z"), 75);
    expect(await openDraft(args())).toMatchObject({ opened: true });
  });

  test("rad etish O'TGAN o'quv yilida — to'smaydi", async () => {
    db.rejected = rejectedAt(LAST_YEAR, 200);
    expect(await openDraft(args())).toMatchObject({ opened: true });
  });

  test("`meros` rad etilgan (eski `countingYear`, joriy `closedAt`) — TO'SADI", async () => {
    db.rejected = rejectedAt(new Date("2026-10-01T09:00:00Z"), 80, "2024/2025");
    expect(await openDraft(args())).toEqual({ opened: false, reason: "reject_watermark" });
  });

  test("rad etish `create` dan keyin ko'rindi — o'z hujjati qaytariladi", async () => {
    let calls = 0;
    db.rejected = () => (calls++ === 0 ? null : rejectedAt(new Date("2026-10-05T09:59:00Z"), 76));
    expect(await openDraft(args())).toEqual({ opened: false, reason: "reject_watermark" });
    expect(Order.deleteOne).toHaveBeenCalledTimes(1);
    expect(pointerWrites()).toHaveLength(0);
  });
});

describe("watermarkApplies — sof qoida", () => {
  const cur = new Date("2026-10-01T00:00:00Z");
  test.each([
    [null, 90, false],
    [{ closedAt: cur, hoursAtClose: 74 }, 74, true],
    [{ closedAt: cur, hoursAtClose: 74 }, 75, false],
    [{ closedAt: cur, hoursAtClose: 74 }, NaN, true],
    [{ closedAt: LAST_YEAR, hoursAtClose: 74 }, 74, false],
    [{ closedAt: undefined, hoursAtClose: 74 }, 74, false],
  ])("%j, soat %s → %s", (last, hours, expected) => {
    expect(watermarkApplies(last, hours, NOW)).toBe(expected);
  });
});

describe("clearStalePointer", () => {
  test("hech bir hujjatga ko'rsatmaydi — o'qilgan qiymat bilan CAS", async () => {
    db.resident = { expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 };
    await clearStalePointer("r1");
    expect(Order.exists).toHaveBeenCalledWith({ resident: "r1", status: { $in: ["loyiha", "imzolangan"] } });
    expect(Resident.updateOne).toHaveBeenCalledWith(
      { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 },
      CLEAR,
    );
  });

  test("ochiq yoki imzolangan hujjat bor — TEGILMAYDI", async () => {
    db.resident = { expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 };
    db.held = { _id: "o1" };
    await clearStalePointer("r1");
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });

  test("bayroq yo'q — hujjat so'ralmaydi ham", async () => {
    db.resident = { expulsionOrderCreated: false };
    await clearStalePointer("r1");
    expect(Order.exists).not.toHaveBeenCalled();
  });
});

describe("cancelDraftBelowThreshold — faqat yopishni YUTGAN tozalaydi", () => {
  const snapshot = { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 };

  test("T2a — yopish CAS'i yutqazildi (shu orada imzolandi): bayroq va xabarlarga TEGILMAYDI", async () => {
    db.open = { _id: "o1", origin: "tizim", countingYear: "2026/2027", draftedAt: new Date(T0) };
    Order.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    await cancelDraftBelowThreshold(snapshot, { hours: 20, source: "cron", now: NOW, awaitRevoke: true });
    expect(Resident.updateOne).not.toHaveBeenCalled();
    expect(revokeExpulsionNotice).not.toHaveBeenCalled();
  });

  test("T2b — ochiq hujjat yo'q, imzolangan bor: bayroq YARIM imzoni ushlab turadi", async () => {
    db.signed = { _id: "s1" };
    await cancelDraftBelowThreshold(snapshot, { hours: 20, source: "attendance", now: NOW });
    expect(Resident.updateOne).not.toHaveBeenCalled();
    expect(revokeExpulsionNoticeInBackground).not.toHaveBeenCalled();
  });
});

describe("repairPointer — imzolangan buyruq bor", () => {
  test("E11000 + adashgan ochiq loyiha + imzolangan — ko'rsatkich YO'NALTIRILMAYDI", async () => {
    let calls = 0;
    db.signed = () => (calls++ === 0 ? null : { _id: "s1" });
    db.open = { _id: "stray", draftedAt: T0 };
    Order.create.mockRejectedValue(Object.assign(new Error("E11000"), { code: 11000 }));
    expect(await openDraft(args())).toEqual({ opened: false, reason: "already_open" });
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });
});

describe("repairPointer — yozuvdan keyin S1 tushdi (ko'rik)", () => {
  test("ko'rsatkich imzolangan buyruqqa qoladi — TOZALANMAYDI", async () => {
    let calls = 0;
    db.signed = () => (calls++ < 2 ? null : { _id: "o0" });
    db.open = () => (calls < 2 ? { _id: "o0", draftedAt: T0 } : null);
    Order.create.mockRejectedValue(Object.assign(new Error("E11000"), { code: 11000 }));
    Order.exists = jest.fn(async (q) => (q._id ? null : byStatus(q)));
    await openDraft(args());
    const clears = Resident.updateOne.mock.calls.filter(([, c]) => c.$set?.expulsionOrderCreated === false);
    expect(clears).toHaveLength(0);
  });
});

describe("reconcileDrafts — P6a-2", () => {
  const armLists = ({ open = [], stuck = [] }) => {
    Order.find = jest.fn((q) => chain(q.status === "loyiha" ? open : stuck));
  };

  test("imzolangan buyrug'i bor rezidentning loyihasi yopiladi — bayroq va ta'mirga tegilmaydi", async () => {
    armLists({ open: [{ _id: "o1", resident: "r1" }] });
    db.signed = { _id: "s1" };
    await reconcileDrafts(NOW);
    const [filter, change] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: "o1", status: "loyiha" });
    expect(change.$set).toMatchObject({ status: "bekor_qilingan", closeReason: "imzolangan_buyruq_bor" });
    expect(change.$push.history.source).toBe("cron");
    expect(Resident.findOne).not.toHaveBeenCalled();
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });

  test("yarim imzo: rezident allaqachon `chetlatilgan` — faqat S2 belgisi qo'yiladi", async () => {
    armLists({ stuck: [{ _id: "o5", resident: "r5" }] });
    Resident.findOneWithDeleted = jest.fn(() => chain({ status: "chetlatilgan" }));
    await reconcileDrafts(NOW);
    expect(Order.find).toHaveBeenCalledWith({
      status: "imzolangan",
      residentAppliedAt: null,
      signedAt: { $lt: new Date(NOW.getTime() - 10 * 60 * 1000) },
    });
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: "o5", status: "imzolangan", residentAppliedAt: null },
      { $set: { residentAppliedAt: NOW } },
    );
  });

  test("yarim imzo: rezident hamon `oquvda` — XATO loglanadi, bayroq tiklanadi, holat yozilmaydi", async () => {
    armLists({ stuck: [{ _id: "o5", resident: "r5", draftedAt: T0 }] });
    Resident.findOneWithDeleted = jest.fn(() => chain({ status: "oquvda" }));
    await reconcileDrafts(NOW);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("order=o5"));
    expect(Order.updateOne).not.toHaveBeenCalled();
    expect(Resident.updateOne).toHaveBeenCalledWith(
      { _id: "r5", status: { $ne: "chetlatilgan" }, expulsionOrderCreated: { $ne: true } },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 } },
    );
    expect(JSON.stringify(Resident.updateOne.mock.calls)).not.toContain('"status":"chetlatilgan"');
  });
});

test("isDraftOpen — faqat `loyiha` holatidagi shu hujjat", async () => {
  await isDraftOpen("o1");
  expect(Order.exists).toHaveBeenCalledWith({ _id: "o1", status: "loyiha" });
});
