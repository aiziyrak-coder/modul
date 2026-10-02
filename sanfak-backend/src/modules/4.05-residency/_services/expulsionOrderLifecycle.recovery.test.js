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
const { countOrderNotices } = require("./expulsionReversal");
const {
  openDraft,
  markNoticesSent,
  findUnannouncedDrafts,
  findUndeliveredDecisions,
  markDecisionDelivered,
  moveReminderStage,
} = require("./expulsionOrderLifecycle");

const NOW = new Date("2026-10-05T10:00:00Z");
const T0 = new Date("2026-09-20T08:00:00Z");
const T1 = new Date("2026-09-21T08:00:00Z");
const chain = (value) => {
  const q = {
    sort: jest.fn(() => q),
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
  };
  return q;
};
const openOnly = (impl, none) =>
  jest.fn((q, ...rest) => (q?.status === "loyiha" ? impl(q, ...rest) : none()));
const dupError = () => Object.assign(new Error("E11000"), { code: 11000 });
const CLEAR = { $set: { expulsionOrderCreated: false, expulsionOrderCreatedAt: null } };
const args = () => ({
  residentId: "r1",
  residentName: "Valiyev Ali",
  source: "cron",
  countHours: jest.fn().mockResolvedValue(76),
  now: NOW,
});

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findOne = jest.fn().mockReturnValue(chain({ status: "oquvda", active: true }));
  Resident.updateOne = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  Order.create = jest.fn().mockResolvedValue({ _id: "order1" });
  Order.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
  Order.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
  Order.exists = openOnly(jest.fn().mockResolvedValue({ _id: "order1" }), async () => null);
  Order.findOne = openOnly(() => chain(null), () => chain(null));
});

describe("ko'rsatkich ta'miri — qayta urinish", () => {
  test("o'qilgan hujjat yopildi — o'z qiymati CAS bilan olinadi, YANGI ochiq hujjatga qayta ko'rsatiladi", async () => {
    Order.create.mockRejectedValue(dupError());
    const openFind = jest
      .fn()
      .mockReturnValueOnce(chain({ _id: "o1", draftedAt: T0 }))
      .mockReturnValueOnce(chain({ _id: "o2", draftedAt: T1 }));
    Order.findOne = openOnly(openFind, () => chain(null));
    const openExists = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "o2" });
    Order.exists = openOnly(openExists, async () => null);

    expect(await openDraft(args())).toEqual({ opened: false, reason: "already_open" });

    const calls = Resident.updateOne.mock.calls;
    expect(calls[1]).toEqual([
      { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 },
      CLEAR,
    ]);
    expect(calls[2][1]).toEqual({
      $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: T1 },
    });
    expect(calls).toHaveLength(3);
  });

  test("ko'rsatkich allaqachon to'g'ri — ortiqcha yozuv va tekshiruv yo'q", async () => {
    Order.create.mockRejectedValue(dupError());
    Order.findOne = openOnly(() => chain({ _id: "o1", draftedAt: T0 }), () => chain(null));
    Resident.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    const openExists = jest.fn();
    Order.exists = openOnly(openExists, async () => null);
    await openDraft(args());
    expect(openExists).not.toHaveBeenCalled();
  });
});

describe("o'z hujjatidan voz kechish", () => {
  test("rezident mos emas — hujjat qaytariladi VA unga ko'rsatgan bayroq tozalanadi", async () => {
    Resident.updateOne
      .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 })
      .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    expect(await openDraft(args())).toEqual({ opened: false, reason: "not_eligible" });
    expect(Order.deleteOne).toHaveBeenCalledTimes(1);
    expect(Resident.updateOne).toHaveBeenLastCalledWith(
      { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: NOW },
      CLEAR,
    );
  });
});

describe("e'lon belgisi", () => {
  test("`markNoticesSent` — faqat hali belgilanmagan hujjatga yoziladi", async () => {
    expect(await markNoticesSent("order1", NOW)).toBe(true);
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: "order1", noticesSentAt: null },
      { $set: { noticesSentAt: NOW } },
    );
  });

  test("bironta xabar saqlanmagan — belgi QO'YILMAYDI (ertaga qayta urinadi)", async () => {
    countOrderNotices.mockResolvedValueOnce(0);
    expect(await markNoticesSent("order1", NOW)).toBe(false);
    expect(Order.updateOne).not.toHaveBeenCalled();
  });

  test("`findUnannouncedDrafts` — faqat `tizim`, e'lonsiz va 10 daqiqadan eski", async () => {
    Order.find = jest.fn().mockReturnValue(chain([]));
    await findUnannouncedDrafts(NOW);
    expect(Order.find).toHaveBeenCalledWith({
      status: "loyiha",
      origin: "tizim",
      noticesSentAt: null,
      draftedAt: { $lt: new Date(NOW.getTime() - 10 * 60 * 1000) },
    });
  });
});

describe("qaror xabari belgilari", () => {
  const OLD = new Date(NOW.getTime() - 11 * 60 * 1000);
  const FRESH = new Date(NOW.getTime() - 60 * 1000);

  test("`findUndeliveredDecisions` — holat, belgisiz va oynadan eski; tur bo'yicha ajratiladi", async () => {
    const signedOld = { _id: "s1", status: "imzolangan", residentAppliedAt: OLD, basisLostAt: OLD, deliveries: { signed: null, basisLost: null } };
    const signedFresh = { _id: "s2", status: "imzolangan", residentAppliedAt: FRESH, deliveries: {} };
    const halfSigned = { _id: "s3", status: "imzolangan", residentAppliedAt: null, deliveries: {} };
    const rejected = { _id: "r1", status: "rad_etilgan", closedAt: OLD, deliveries: { rejected: null } };
    const delivered = { _id: "r2", status: "rad_etilgan", closedAt: OLD, deliveries: { rejected: OLD } };
    Order.find = jest.fn().mockReturnValue(chain([signedOld, signedFresh, halfSigned, rejected, delivered]));
    const due = await findUndeliveredDecisions(NOW);
    expect(due.map(({ order, kind }) => `${order._id}:${kind}`)).toEqual(["s1:signed", "s1:basisLost", "r1:rejected"]);
    const before = new Date(NOW.getTime() - 10 * 60 * 1000);
    expect(Order.find.mock.calls[0][0]).toEqual({
      $or: [
        { status: "imzolangan", "deliveries.signed": null, residentAppliedAt: { $ne: null, $lt: before } },
        { status: "rad_etilgan", "deliveries.rejected": null, closedAt: { $ne: null, $lt: before } },
        { status: "imzolangan", "deliveries.basisLost": null, basisLostAt: { $ne: null, $lt: before } },
      ],
    });
  });

  test("`markDecisionDelivered` — bir marta (`field: null` sharti)", async () => {
    await markDecisionDelivered("o1", "basisLost", NOW);
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: "o1", "deliveries.basisLost": null },
      { $set: { "deliveries.basisLost": NOW } },
    );
  });

  test("`moveReminderStage` — ochiq hujjatda o'qilgan qiymat bo'yicha CAS", async () => {
    Order.updateOne = jest.fn().mockResolvedValueOnce({ modifiedCount: 1 }).mockResolvedValue({ modifiedCount: 0 });
    await expect(moveReminderStage("o1", undefined, 1)).resolves.toBe(true);
    expect(Order.updateOne).toHaveBeenLastCalledWith(
      { _id: "o1", status: "loyiha", remindedStage: null },
      { $set: { remindedStage: 1 } },
    );
    await expect(moveReminderStage("o1", 2, 1)).resolves.toBe(false);
    expect(Order.updateOne).toHaveBeenLastCalledWith(
      { _id: "o1", status: "loyiha", remindedStage: 2 },
      { $set: { remindedStage: 1 } },
    );
  });
});
