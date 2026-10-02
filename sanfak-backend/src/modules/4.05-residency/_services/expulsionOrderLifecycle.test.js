jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
jest.mock("./expulsionReversal", () => ({
  revokeExpulsionNotice: jest.fn().mockResolvedValue(0),
  revokeExpulsionNoticeInBackground: jest.fn(),
  revokeNoticesWithoutOpenDraft: jest.fn().mockResolvedValue(0),
}));
jest.mock("#shared/winston.logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const {
  revokeExpulsionNotice,
  revokeExpulsionNoticeInBackground,
  revokeNoticesWithoutOpenDraft,
} = require("./expulsionReversal");
const winston = require("#shared/winston.logger");
const {
  openDraft,
  cancelDraftBelowThreshold,
  closeDraftForDeletedResident,
  settleDraftNotices,
  reconcileDrafts,
  canHoldDraft,
  isEligible,
} = require("./expulsionOrderLifecycle");

const NOW = new Date("2026-10-05T10:00:00Z");
const T0 = new Date("2026-09-20T08:00:00Z");

const chain = (value) => {
  const q = {
    sort: jest.fn(() => q),
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
  };
  return q;
};
const openOnly = (impl, none) =>
  jest.fn((q, ...rest) => (q?.status === "loyiha" ? impl(q, ...rest) : none()));
const openExists = (impl) => openOnly(impl, () => Promise.resolve(null));
const openFind = (value) => openOnly(() => chain(value), () => chain(null));
const openList = (list) => openOnly(() => chain(list), () => chain([]));
const dupError = () => Object.assign(new Error("E11000"), { code: 11000 });
const IN_STUDY = { status: "oquvda", active: true };

const baseArgs = (overrides = {}) => ({
  residentId: "r1",
  residentName: "Valiyev Ali",
  source: "cron",
  countHours: jest.fn().mockResolvedValue(76),
  now: NOW,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findOne = jest.fn().mockReturnValue(chain(IN_STUDY));
  Resident.updateOne = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  Order.exists = openExists(() => Promise.resolve({ _id: "order1" }));
  Order.create = jest.fn().mockResolvedValue({ _id: "order1" });
  Order.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
  Order.findOne = openFind(null);
  Order.findOneAndUpdate = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue({ _id: "order1" }),
  });
});

describe("openDraft — hujjat QULF, bayroq undan KEYIN", () => {
  test("hujjat jonli soat bilan yaratiladi, keyin bayroq unga ko'rsatadi", async () => {
    const res = await openDraft(baseArgs());
    expect(res).toEqual({ opened: true, orderId: "order1", hours: 76 });
    expect(Order.create).toHaveBeenCalledWith({
      resident: "r1",
      residentName: "Valiyev Ali",
      origin: "tizim",
      status: "loyiha",
      countingYear: "2026/2027",
      draftedAt: NOW,
      hoursAtDraft: 76,
      history: [{ at: NOW, action: "yaratildi", source: "cron", hours: 76 }],
    });
    expect(Resident.updateOne).toHaveBeenCalledWith(
      {
        _id: "r1",
        deletedAt: null,
        active: { $ne: false },
        status: { $in: ["oquvda", null] },
      },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: NOW } },
    );
    expect(Order.create.mock.invocationCallOrder[0]).toBeLessThan(
      Resident.updateOne.mock.invocationCallOrder[0],
    );
  });

  test.each([71.9, NaN])("jonli soat %s — hujjat YARATILMAYDI", async (h) => {
    const res = await openDraft(baseArgs({ countHours: jest.fn().mockResolvedValue(h) }));
    expect(res).toEqual({ opened: false, reason: "below_threshold" });
    expect(Order.create).not.toHaveBeenCalled();
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });

  test.each([
    ["o'chirilgan (findOne → null)", null],
    ["akademik ta'til", { status: "akademik_tatil", active: true }],
    ["chetlatilgan", { status: "chetlatilgan", active: true }],
    ["active:false (P3 dan oldingi mashina)", { status: "oquvda", active: false }],
  ])("%s — hujjat YARATILMAYDI, soat hisoblanmaydi", async (_label, live) => {
    Resident.findOne = jest.fn().mockReturnValue(chain(live));
    const args = baseArgs();
    expect(await openDraft(args)).toEqual({ opened: false, reason: "not_eligible" });
    expect(args.countHours).not.toHaveBeenCalled();
    expect(Order.create).not.toHaveBeenCalled();
  });
});

describe("openDraft — E11000 va orqaga qaytish", () => {
  test("E11000 — ochiq hujjat bor: xabar yo'q, ko'rsatkich unga to'g'rilanadi", async () => {
    Order.create.mockRejectedValue(dupError());
    Order.findOne = openFind({ _id: "o0", draftedAt: T0 });
    expect(await openDraft(baseArgs())).toEqual({ opened: false, reason: "already_open" });
    expect(Resident.updateOne).toHaveBeenCalledWith(
      {
        _id: "r1",
        $or: [
          { expulsionOrderCreated: { $ne: true } },
          { expulsionOrderCreatedAt: { $ne: T0 } },
        ],
      },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 } },
    );
  });

  test("ta'mir paytida hujjat yopildi — ko'rsatkich CAS bilan QAYTARILADI", async () => {
    Order.create.mockRejectedValue(dupError());
    Order.findOne = openFind({ _id: "o0", draftedAt: T0 });
    Order.exists.mockResolvedValue(null);
    await openDraft(baseArgs());
    expect(Resident.updateOne).toHaveBeenLastCalledWith(
      { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 },
      { $set: { expulsionOrderCreated: false, expulsionOrderCreatedAt: null } },
    );
  });

  test("hujjat yozilayotganda rezident mos emas bo'ldi — o'z hujjatimiz QAYTARILADI", async () => {
    Resident.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    expect(await openDraft(baseArgs())).toEqual({ opened: false, reason: "not_eligible" });
    expect(Order.deleteOne).toHaveBeenCalledWith({
      _id: "order1",
      status: "loyiha",
      "history.1": { $exists: false },
    });
  });

  test("bayroq yozuvi yiqildi — hujjat qaytariladi, xato yuqoriga chiqadi", async () => {
    Resident.updateOne.mockRejectedValue(new Error("Mongo down"));
    await expect(openDraft(baseArgs())).rejects.toThrow("Mongo down");
    expect(Order.deleteOne).toHaveBeenCalledTimes(1);
  });

  test("boshqa `create` xatosi — yuqoriga chiqadi, hech narsa qoldirmaydi", async () => {
    Order.create.mockRejectedValue(new Error("validation"));
    await expect(openDraft(baseArgs())).rejects.toThrow("validation");
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });
});

describe("cancelDraftBelowThreshold — ko'rsatkich bo'yicha yopish", () => {
  const snapshot = (at = T0) => ({ _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: at });
  const armOpen = (open) => {
    Order.findOne = openFind(open);
  };

  test.each([
    ["2026/2027", "soat_72_dan_past"],
    ["2025/2026", "yangi_oquv_yili"],
  ])("yil %s — sabab `%s`; bayroq CAS bilan tozalanadi", async (year, reason) => {
    armOpen({ _id: "o1", origin: "tizim", countingYear: year, draftedAt: new Date(T0) });
    await cancelDraftBelowThreshold(snapshot(), { hours: 20, source: "application", now: NOW });
    const [filter, change] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: "o1", status: "loyiha" });
    expect(change.$set).toMatchObject({ status: "bekor_qilingan", closeReason: reason, closedBy: null });
    expect(change.$push.history).toMatchObject({ action: "bekor_qilindi", source: "application", hours: 20 });
    expect(Resident.updateOne).toHaveBeenCalledWith(
      { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 },
      { $set: { expulsionOrderCreated: false, expulsionOrderCreatedAt: null } },
    );
    expect(revokeExpulsionNoticeInBackground).toHaveBeenCalledWith("r1");
  });
});

describe("cancelDraftBelowThreshold — nimaga TEGILMAYDI", () => {
  const snapshot = (at = T0) => ({ _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: at });
  const armOpen = (open) => {
    Order.findOne = openFind(open);
  };

  test("ochiq hujjat BOSHQA (yangi) — yopilmaydi, bayroq tegilmaydi", async () => {
    armOpen({ _id: "o2", origin: "tizim", countingYear: "2026/2027", draftedAt: NOW });
    await cancelDraftBelowThreshold(snapshot(T0), { hours: 20, source: "cron", now: NOW });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });

  test("`meros` — YOPILMAYDI, bayroq tegilmaydi", async () => {
    armOpen({ _id: "o1", origin: "meros", countingYear: "2025/2026", draftedAt: T0 });
    await cancelDraftBelowThreshold(snapshot(), { hours: 0, source: "cron", now: NOW });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Resident.updateOne).not.toHaveBeenCalled();
  });

  test("hujjatsiz eski bayroq — faqat bayroq (CAS) va xabarlar", async () => {
    await cancelDraftBelowThreshold(snapshot(null), { hours: 20, source: "cron", now: NOW });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Resident.updateOne.mock.calls[0][0]).toEqual({
      _id: "r1",
      expulsionOrderCreated: true,
      expulsionOrderCreatedAt: null,
    });
    expect(revokeExpulsionNoticeInBackground).toHaveBeenCalledWith("r1");
  });

  test("xato — loglanadi, throw YO'Q", async () => {
    Order.findOne = jest.fn().mockImplementation(() => {
      throw new Error("Mongo down");
    });
    await expect(
      cancelDraftBelowThreshold(snapshot(), { hours: 20, source: "cron", now: NOW }),
    ).resolves.toBeUndefined();
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("Mongo down"));
  });
});

describe("closeDraftForDeletedResident — rezident o'chirilganda", () => {
  const actor = { _id: "u-office", lastName: "Karimova", firstName: "Nodira" };

  test("ochiq hujjat (`meros` ham) yopiladi, bayroq tozalanadi", async () => {
    await closeDraftForDeletedResident("r1", actor, NOW);
    const [filter, change] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ resident: "r1", status: "loyiha" });
    expect(change.$set).toMatchObject({
      closeReason: "rezident_ochirildi",
      closedBy: "u-office",
      closedByName: "Karimova Nodira",
    });
    expect(Resident.updateOne).toHaveBeenCalledWith(
      { _id: "r1" },
      { $set: { expulsionOrderCreated: false, expulsionOrderCreatedAt: null } },
    );
    expect(revokeExpulsionNoticeInBackground).toHaveBeenCalledWith("r1");
  });

  test("xato o'chirishni YIQITMAYDI — loglanadi", async () => {
    Order.findOneAndUpdate = jest.fn().mockImplementation(() => {
      throw new Error("Mongo down");
    });
    await expect(closeDraftForDeletedResident("r1", actor, NOW)).resolves.toBeUndefined();
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("Mongo down"));
  });
});

describe("canHoldDraft / isEligible — `evaluateResident` bilan bir xil qoida", () => {
  test.each([
    [undefined, true],
    [null, true],
    ["oquvda", true],
    ["akademik_tatil", false],
    ["chetlatilgan", false],
  ])("status %s → %s", (status, expected) => {
    expect(canHoldDraft(status)).toBe(expected);
  });

  test.each([
    [null, false],
    [{ status: "oquvda" }, true],
    [{ status: "oquvda", active: true }, true],
    [{ status: "oquvda", active: false }, false],
  ])("jonli %j → %s", (live, expected) => {
    expect(isEligible(live)).toBe(expected);
  });
});

describe("settleDraftNotices — xabarlar yetkazilgandan keyin", () => {
  test("loyiha hali ochiq — hech narsa bekor qilinmaydi", async () => {
    await settleDraftNotices("r1", "order1");
    expect(Order.exists).toHaveBeenCalledWith({ _id: "order1", status: "loyiha" });
    expect(revokeExpulsionNotice).not.toHaveBeenCalled();
  });

  test("loyiha shu orada yopildi — endigina saqlangan xabarlar KUTIB bekor qilinadi", async () => {
    Order.exists.mockResolvedValue(null);
    await settleDraftNotices("r1", "order1");
    expect(revokeExpulsionNotice).toHaveBeenCalledWith("r1");
  });
});

describe("bekor qilish sweep'da KUTILADI (`awaitRevoke`)", () => {
  const snapshot = { _id: "r1", expulsionOrderCreated: true, expulsionOrderCreatedAt: null };

  test("`awaitRevoke: true` — sinxron bekor qilish, fonda EMAS", async () => {
    await cancelDraftBelowThreshold(snapshot, { hours: 0, source: "cron", now: NOW, awaitRevoke: true });
    expect(revokeExpulsionNotice).toHaveBeenCalledWith("r1");
    expect(revokeExpulsionNoticeInBackground).not.toHaveBeenCalled();
  });

  test("standart (HTTP yo'li) — fonda", async () => {
    await cancelDraftBelowThreshold(snapshot, { hours: 0, source: "attendance", now: NOW });
    expect(revokeExpulsionNoticeInBackground).toHaveBeenCalledWith("r1");
    expect(revokeExpulsionNotice).not.toHaveBeenCalled();
  });
});

describe("reconcileDrafts — kunlik yarashtirish", () => {
  const armOpenOrders = (list) => {
    Order.find = openList(list);
  };

  test("o'chirilgan rezidentning ochiq loyihasi yopiladi (kutib, `cron` manbasi)", async () => {
    armOpenOrders([{ _id: "o1", resident: "r1" }]);
    Resident.findOne = jest.fn().mockReturnValue(chain(null));
    await reconcileDrafts(NOW);
    const [filter, change] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ resident: "r1", status: "loyiha" });
    expect(change.$set.closeReason).toBe("rezident_ochirildi");
    expect(change.$push.history.source).toBe("cron");
    expect(revokeExpulsionNotice).toHaveBeenCalledWith("r1");
  });

  test("tirik rezident — ko'rsatkichi ochiq hujjatga to'g'rilanadi", async () => {
    armOpenOrders([{ _id: "o1", resident: "r1" }]);
    Resident.findOne = jest.fn().mockReturnValue(chain({ _id: "r1" }));
    Order.findOne = openFind({ _id: "o1", draftedAt: T0 });
    await reconcileDrafts(NOW);
    expect(Resident.updateOne.mock.calls[0][1]).toEqual({
      $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 },
    });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("bitta hujjatdagi xato qolganlarini to'xtatmaydi; eskirgan xabarlar baribir olinadi", async () => {
    armOpenOrders([{ _id: "o1", resident: "r1" }, { _id: "o2", resident: "r2" }]);
    Resident.findOne = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Mongo down");
      })
      .mockReturnValue(chain(null));
    await reconcileDrafts(NOW);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("o1"));
    expect(Order.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(revokeNoticesWithoutOpenDraft).toHaveBeenCalledWith(NOW);
  });
});
