jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { changeStudyStatus, closeBeforeResidentDelete } = require("./expulsionOrderGuards");

const chain = (value) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});
const reasonOf = (reason, code = 409) =>
  expect.objectContaining({ statusCode: code, meta: expect.objectContaining({ reason }) });

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findOne = jest.fn(() => chain({ status: "oquvda" }));
  Resident.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: "r1", status: "akademik_tatil" });
  Order.findOne = jest.fn(() => chain(null));
});

describe("changeStudyStatus — ta'tilga chiqish", () => {
  test("ochiq YOKI imzolangan buyruq tekshiriladi; bor bo'lsa 409 + `orderId`", async () => {
    Order.findOne = jest.fn(() => chain({ _id: "o7" }));
    await expect(changeStudyStatus({ residentId: "r1", to: "akademik_tatil" })).rejects.toEqual(
      expect.objectContaining({ meta: { reason: "expulsion_order_open", orderId: "o7" } }),
    );
    expect(Order.findOne).toHaveBeenCalledWith({
      resident: "r1",
      status: { $in: ["loyiha", "imzolangan"] },
    });
    expect(Resident.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("CAS: xom holat (`null` — maydon yo'q) + bayroq sharti", async () => {
    Resident.findOne = jest.fn(() => chain({}));
    const res = await changeStudyStatus({ residentId: "r1", to: "akademik_tatil" });
    expect(Resident.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "r1", status: null, expulsionOrderCreated: { $ne: true } },
      { $set: { status: "akademik_tatil" } },
      { new: true, runValidators: true },
    );
    expect(res).toMatchObject({ changed: true, from: null });
  });

  test("CAS yutqazildi, holat o'sha-yu bayroq yoqildi — `expulsion_order_open`", async () => {
    Resident.findOne = jest
      .fn()
      .mockReturnValueOnce(chain({ status: "oquvda" }))
      .mockReturnValue(chain({ status: "oquvda", expulsionOrderCreated: true }));
    Resident.findOneAndUpdate.mockResolvedValue(null);
    await expect(changeStudyStatus({ residentId: "r1", to: "akademik_tatil" })).rejects.toEqual(
      reasonOf("expulsion_order_open"),
    );
  });

  test("CAS yutqazildi, holat o'zgargan — `status_conflict`", async () => {
    Resident.findOne = jest
      .fn()
      .mockReturnValueOnce(chain({ status: "oquvda" }))
      .mockReturnValue(chain({ status: "akademik_tatil" }));
    Resident.findOneAndUpdate.mockResolvedValue(null);
    await expect(changeStudyStatus({ residentId: "r1", to: "akademik_tatil" })).rejects.toEqual(
      reasonOf("status_conflict"),
    );
  });
});

describe("changeStudyStatus — boshqa o'tishlar", () => {
  test("ta'tildan qaytish: buyruq tekshirilmaydi, bayroq sharti YO'Q", async () => {
    Resident.findOne = jest.fn(() => chain({ status: "akademik_tatil" }));
    await changeStudyStatus({ residentId: "r1", to: "oquvda" });
    expect(Order.findOne).not.toHaveBeenCalled();
    expect(Resident.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: "r1", status: "akademik_tatil" });
  });

  test("qaytishda CAS yutqazildi — `status_conflict` (bayroqqa qaralmaydi)", async () => {
    Resident.findOne = jest.fn(() => chain({ status: "akademik_tatil", expulsionOrderCreated: true }));
    Resident.findOneAndUpdate.mockResolvedValue(null);
    await expect(changeStudyStatus({ residentId: "r1", to: "oquvda" })).rejects.toEqual(
      reasonOf("status_conflict"),
    );
  });

  test("`chetlatilgan` → 409 `resident_expelled`", async () => {
    Resident.findOne = jest.fn(() => chain({ status: "chetlatilgan" }));
    await expect(changeStudyStatus({ residentId: "r1", to: "oquvda" })).rejects.toEqual(
      reasonOf("resident_expelled"),
    );
    expect(Resident.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("o'zgarish yo'q (maydon yo'q = o'qishda) — yozuv yo'q", async () => {
    Resident.findOne = jest.fn(() => chain({}));
    expect(await changeStudyStatus({ residentId: "r1", to: "oquvda" })).toEqual({ changed: false, from: null });
    expect(Resident.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("topilmadi (o'chirilgan) → 404", async () => {
    Resident.findOne = jest.fn(() => chain(null));
    await expect(changeStudyStatus({ residentId: "r1", to: "oquvda" })).rejects.toEqual(
      reasonOf("resident_not_found", 404),
    );
  });
});

describe("closeBeforeResidentDelete — V-3=A", () => {
  const NOW = new Date("2026-10-05T10:00:00Z");
  const actor = { _id: "u-office", lastName: "Karimova", firstName: "Nodira" };
  beforeEach(() => {
    Order.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "o1" }) });
    Order.exists = jest.fn().mockResolvedValue(null);
  });

  test("ochiq loyiha imzo bilan BIR CAS'da yopiladi (`meros` ham)", async () => {
    await closeBeforeResidentDelete("r1", actor, NOW);
    const [filter, change] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ resident: "r1", status: "loyiha" });
    expect(change.$set).toMatchObject({ status: "bekor_qilingan", closeReason: "rezident_ochirildi", closedBy: "u-office" });
    expect(change.$push.history).toMatchObject({ source: "resident_delete" });
  });

  test("`chetlatilgan` — 409 `resident_expelled`, hech narsa yopilmaydi", async () => {
    Resident.findOne = jest.fn(() => chain({ status: "chetlatilgan" }));
    await expect(closeBeforeResidentDelete("r1", actor, NOW)).rejects.toEqual(reasonOf("resident_expelled"));
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("imzolangan buyruq — 409 `expulsion_order_signed`, tekshiruv yopishdan KEYIN", async () => {
    Order.exists = jest.fn().mockResolvedValue({ _id: "s1" });
    await expect(closeBeforeResidentDelete("r1", actor, NOW)).rejects.toEqual(reasonOf("expulsion_order_signed"));
    expect(Order.exists).toHaveBeenCalledWith({ resident: "r1", status: "imzolangan" });
    expect(Order.findOneAndUpdate.mock.invocationCallOrder[0]).toBeLessThan(Order.exists.mock.invocationCallOrder[0]);
  });
});
