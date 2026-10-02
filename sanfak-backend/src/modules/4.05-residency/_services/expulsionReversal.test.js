jest.mock("#system/notification/notification.model", () => ({
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  distinct: jest.fn(),
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model", () => ({
  ORDER_OPEN: "loyiha",
  findOne: jest.fn(),
  find: jest.fn(),
}));
jest.mock("#shared/winston.logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const Notification = require("#system/notification/notification.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const winston = require("#shared/winston.logger");
const { EXPULSION_HOURS } = require("./attendanceWarning");
const {
  RESIDENT_EVENT_TYPE,
  OFFICE_EVENT_TYPE,
  shouldCancelDraft,
  revokeExpulsionNotice,
  revokeExpulsionNoticeInBackground,
  revokeNoticesWithoutOpenDraft,
  revokeLegacyExpulsionNotice,
  signedBasisLost,
  countOrderNotices,
  countDecisionNotices,
  reminderRecipients,
  supersedeReminders,
} = require("./expulsionReversal");
const { EVENTS } = require("./residentNotify");

const armOpen = (open) => {
  Order.findOne.mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(open) }),
  });
};
const flagged = (extra = {}) => ({ expulsionOrderCreated: true, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  Notification.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
  armOpen(null);
});

describe("shouldCancelDraft — bekor qilish qoidasi", () => {
  test("soat ostonadan PAST va bayroq yoqilgan — bekor qilinadi", () => {
    expect(shouldCancelDraft(flagged(), 20)).toBe(true);
  });

  test("rezident hujjatiga HECH NARSA yozmaydi", () => {
    const resident = flagged();
    shouldCancelDraft(resident, 20);
    expect(resident).toEqual({ expulsionOrderCreated: true });
  });

  test("HAMON ostonada — bekor qilinmaydi", () => {
    expect(shouldCancelDraft(flagged(), EXPULSION_HOURS)).toBe(false);
  });

  test("bayroq yoqilmagan — bekor qilishga hech narsa yo'q", () => {
    expect(shouldCancelDraft({ expulsionOrderCreated: false }, 0)).toBe(false);
  });

  test("maydon proyeksiyaga kirmagan (`undefined`) — `false`, jim yiqilmaydi", () => {
    expect(shouldCancelDraft({}, 0)).toBe(false);
  });

  test("rezident `null`/`undefined` — yiqilmaydi", () => {
    expect(shouldCancelDraft(null, 0)).toBe(false);
    expect(shouldCancelDraft(undefined, 0)).toBe(false);
  });

  test("NaN soat — bekor qilinmaydi", () => {
    expect(shouldCancelDraft(flagged(), NaN)).toBe(false);
  });
});

describe("shouldCancelDraft — P6a istisnolari", () => {
  test("`chetlatilgan` — bekor qilinmaydi", () => {
    expect(shouldCancelDraft(flagged({ status: "chetlatilgan" }), 2)).toBe(false);
  });

  test("`active: false` — bekor qilinmaydi (migratsiya kutilmoqda)", () => {
    expect(shouldCancelDraft(flagged({ active: false }), 2)).toBe(false);
  });

  test.each(["oquvda", "akademik_tatil", undefined])("status `%s` — bekor qilinadi", (status) => {
    expect(shouldCancelDraft(flagged({ status, active: true }), 2)).toBe(true);
  });
});

describe("revokeExpulsionNotice — bildirishnoma filtri", () => {
  test("rezident VA bo'lim yozuvlarini BITTA so'rovda bekor qiladi", async () => {
    const n = await revokeExpulsionNotice("resident1");
    expect(n).toBe(2);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      {
        eventType: { $in: [RESIDENT_EVENT_TYPE, OFFICE_EVENT_TYPE] },
        "metadata.residentId": "resident1",
        active: true,
      },
      { active: false },
    );
  });

  test("filtr `user` ga BOG'LANMAGAN", async () => {
    await revokeExpulsionNotice("resident1");
    expect(Notification.updateMany.mock.calls[0][0]).not.toHaveProperty("user");
  });

  test("ObjectId berilsa ham satr sifatida qidiriladi", async () => {
    await revokeExpulsionNotice({ toString: () => "abc123" });
    expect(Notification.updateMany.mock.calls[0][0]["metadata.residentId"]).toBe("abc123");
  });

  test("O'CHIRMAYDI — faqat `active:false` (audit izi qoladi)", async () => {
    await revokeExpulsionNotice("resident1");
    expect(Notification.updateMany.mock.calls[0][1]).toEqual({ active: false });
    expect(Notification.deleteMany).toBeUndefined();
  });

  test("`residentId` bo'sh — so'rov umuman qilinmaydi", async () => {
    expect(await revokeExpulsionNotice(null)).toBe(0);
    expect(Notification.updateMany).not.toHaveBeenCalled();
  });

  test("`modifiedCount` bo'lmasa 0 qaytadi", async () => {
    Notification.updateMany = jest.fn().mockResolvedValue({});
    expect(await revokeExpulsionNotice("r1")).toBe(0);
  });

  test("ochiq loyiha bor — uning xabarlaridan BOSHQA hammasi olinadi", async () => {
    armOpen({ _id: "o2" });
    await revokeExpulsionNotice("resident1");
    expect(Order.findOne).toHaveBeenCalledWith({ resident: "resident1", status: "loyiha" });
    expect(Notification.updateMany.mock.calls[0][0]["metadata.orderId"]).toEqual({ $ne: "o2" });
  });
});

describe("revokeExpulsionNoticeInBackground — bloklamaydi", () => {
  test("darhol qaytadi, ish keyin bajariladi", async () => {
    revokeExpulsionNoticeInBackground("resident1");
    expect(Notification.updateMany).not.toHaveBeenCalled();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(Notification.updateMany).toHaveBeenCalledTimes(1);
  });

  test("DB xatosi yutiladi va LOGLANADI (bo'sh catch emas — §1.4)", async () => {
    Notification.updateMany = jest.fn().mockRejectedValue(new Error("Mongo down"));
    revokeExpulsionNoticeInBackground("resident1");
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("Mongo down"));
  });
});

describe("revokeNoticesWithoutOpenDraft — kunlik tozalash filtri", () => {
  const R1 = "64b000000000000000000001";
  const R2 = "64b000000000000000000002";
  const STARTED = new Date("2026-10-05T08:00:00Z");

  test("loyihasiz — hammasi; ochiq loyihalida — faqat boshqa buyruqning id'li xabarlari", async () => {
    Notification.distinct.mockResolvedValue([R1, R2, "not-an-id"]);
    Order.find.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: "o2", resident: R2 }]) }),
    });
    await revokeNoticesWithoutOpenDraft(STARTED);
    const [filter] = Notification.updateMany.mock.calls[0];
    expect(filter.createdAt).toEqual({ $lt: STARTED });
    expect(filter.$or).toEqual([
      { "metadata.residentId": R2, "metadata.orderId": { $exists: true, $ne: "o2" } },
      { "metadata.residentId": { $in: [R1] } },
    ]);
  });

  test("faol xabar yo'q — yozuv umuman yo'q", async () => {
    Notification.distinct.mockResolvedValue([]);
    expect(await revokeNoticesWithoutOpenDraft(STARTED)).toBe(0);
    expect(Notification.updateMany).not.toHaveBeenCalled();
  });
});

describe("revokeLegacyExpulsionNotice", () => {
  test("rezident akkauntining id'siz ESKI xabari — faqat `active:false`", async () => {
    Notification.updateMany.mockResolvedValueOnce({ modifiedCount: 1 });
    expect(await revokeLegacyExpulsionNotice("u-res")).toBe(1);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      {
        eventType: RESIDENT_EVENT_TYPE,
        user: "u-res",
        "metadata.residentId": { $exists: false },
        active: true,
      },
      { active: false },
    );
  });

  test("akkaunt yo'q (OneID bog'lanmagan) — so'rov yo'q", async () => {
    Notification.updateMany.mockClear();
    expect(await revokeLegacyExpulsionNotice(null)).toBe(0);
    expect(Notification.updateMany).not.toHaveBeenCalled();
  });
});

describe("P6a-2 — U-7 qoidasi va qaror xabarlari", () => {
  test.each([
    [{ status: "chetlatilgan" }, 71, true],
    [{ status: "chetlatilgan" }, 72, false],
    [{ status: "chetlatilgan" }, NaN, false],
    [{ status: "oquvda" }, 10, false],
    [{ status: "akademik_tatil" }, 10, false],
    [null, 10, false],
  ])("signedBasisLost(%j, %s) → %s", (resident, hours, expected) => {
    expect(signedBasisLost(resident, hours)).toBe(expected);
  });

  test("countDecisionNotices — tur va buyruq id'si (satr) bo'yicha", async () => {
    await countDecisionNotices({ toString: () => "o1" }, EVENTS.EXPULSION_SIGNED);
    expect(Notification.countDocuments).toHaveBeenCalledWith({
      eventType: "residency_expulsion_signed",
      "metadata.orderId": "o1",
    });
  });

  test("qaror turlari loyiha ro'yxatlariga KIRMAYDI", async () => {
    Order.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
    Notification.distinct.mockResolvedValue([]);
    await revokeExpulsionNotice("r1");
    const revokeList = Notification.updateMany.mock.calls.at(-1)[0].eventType.$in;
    await countOrderNotices("o1");
    Notification.distinct.mockResolvedValueOnce(["64b0000000000000000000a1"]);
    Order.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
    await revokeNoticesWithoutOpenDraft(new Date());
    const lists = [
      revokeList,
      Notification.countDocuments.mock.calls.at(-1)[0].eventType.$in,
      Notification.distinct.mock.calls.at(-1)[1].eventType.$in,
      Notification.updateMany.mock.calls.at(-1)[0].eventType.$in,
    ];
    for (const list of lists) {
      expect(list).toEqual([RESIDENT_EVENT_TYPE, OFFICE_EVENT_TYPE]);
      for (const decision of [EVENTS.EXPULSION_SIGNED, EVENTS.EXPULSION_REJECTED, EVENTS.EXPULSION_BASIS_LOST_OFFICE]) {
        expect(list).not.toContain(decision);
      }
    }
  });
});

describe("P6b — bo'lim eslatmalari", () => {
  test("reminderRecipients — shu buyruq va bosqich bo'yicha saqlangan xodimlar", async () => {
    Notification.distinct.mockResolvedValueOnce(["u1"]);
    await expect(reminderRecipients({ toString: () => "o1" }, 2)).resolves.toEqual(["u1"]);
    expect(Notification.distinct).toHaveBeenCalledWith("user", {
      eventType: OFFICE_EVENT_TYPE,
      "metadata.orderId": "o1",
      "metadata.reminderStage": 2,
    });
  });

  test("supersedeReminders — faqat eski bosqich, faqat saqlangan xodimlarda, faqat faol", async () => {
    await expect(supersedeReminders("o1", 3, ["u1", "u2"])).resolves.toBe(2);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      {
        eventType: OFFICE_EVENT_TYPE,
        "metadata.orderId": "o1",
        "metadata.reminderStage": { $lt: 3 },
        user: { $in: ["u1", "u2"] },
        active: true,
      },
      { active: false },
    );
  });
});
