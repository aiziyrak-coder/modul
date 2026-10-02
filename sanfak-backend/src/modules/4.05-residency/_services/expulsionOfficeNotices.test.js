jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue({ notification: {} }),
}));
jest.mock("./residentNotify", () => ({
  ...jest.requireActual("./residentNotify"),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("./officeRecipients", () => ({ officeUserIds: jest.fn().mockResolvedValue(["of1", "of2"]) }));
jest.mock("./expulsionReversal", () => ({ countDecisionNotices: jest.fn() }));
jest.mock("./expulsionOrderLifecycle", () => ({
  findUndeliveredDecisions: jest.fn().mockResolvedValue([]),
  markDecisionDelivered: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
}));
jest.mock("./expulsionOrderDecision", () => ({ markSignedBasisLost: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Resident = require("#modules/4.05-residency/resident/resident.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { countDecisionNotices } = require("./expulsionReversal");
const { findUndeliveredDecisions, markDecisionDelivered } = require("./expulsionOrderLifecycle");
const { markSignedBasisLost } = require("./expulsionOrderDecision");
const winston = require("#shared/winston.logger");
const { Types } = require("mongoose");
const { expulsionOrderLink } = require("./residentNotify");
const {
  deliverDecision,
  announceDecisionNotices,
  basisLostEffects,
} = require("./expulsionOfficeNotices");

const order = {
  _id: "o1",
  resident: "r1",
  residentName: "Valiyev Ali",
  paperOrderNumber: "12-ch",
  paperOrderDate: "2026-10-03",
  hoursAtSign: 76,
  hoursAtBasisLost: 40,
};
const armResident = (doc) => {
  Resident.findOne = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  armResident({ user: "u-res" });
  countDecisionNotices.mockResolvedValueOnce(0).mockResolvedValue(1);
});

describe("deliverDecision", () => {
  test("U-6 — rezidentga, FAQAT ilova ichida, id'lar satr; keyin belgi", async () => {
    expect(await deliverDecision(order, "signed")).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({
      userId: "u-res",
      eventType: "residency_expulsion_signed",
      title: "Chetlatish buyrug'i rasmiylashtirildi",
      body: expect.stringContaining("12-ch"),
      metadata: { residentId: "r1", orderId: "o1" },
      overrideChannels: { inApp: true },
    });
    expect(dispatch.mock.calls[0][0].body).not.toMatch(/ERI/);
    expect(markDecisionDelivered).toHaveBeenCalledWith("o1", "signed");
  });

  test("V-5 — sabab matni xabarga KIRMAYDI", async () => {
    await deliverDecision({ ...order, closeNote: "maxfiy sabab" }, "rejected");
    const payload = dispatch.mock.calls[0][0];
    expect(payload.eventType).toBe("residency_expulsion_rejected");
    expect(JSON.stringify(payload)).not.toContain("maxfiy sabab");
    expect(payload.link).toBeUndefined();
  });

  test("U-7 — bo'limning har xodimiga", async () => {
    await deliverDecision(order, "basisLost");
    expect(dispatch.mock.calls.map(([p]) => p.userId)).toEqual(["of1", "of2"]);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      eventType: "residency_expulsion_basis_lost_office",
      link: "/residency/chetlatish-buyruqlari/o1",
      overrideChannels: { inApp: true },
    });
  });

  test("allaqachon saqlangan — takror YO'Q, faqat belgi", async () => {
    countDecisionNotices.mockReset().mockResolvedValue(1);
    await deliverDecision(order, "signed");
    expect(dispatch).not.toHaveBeenCalled();
    expect(markDecisionDelivered).toHaveBeenCalledWith("o1", "signed");
  });

  test("hech narsa saqlanmadi — belgi QO'YILMAYDI (ertaga qayta)", async () => {
    countDecisionNotices.mockReset().mockResolvedValue(0);
    expect(await deliverDecision(order, "signed")).toBe(false);
    expect(markDecisionDelivered).not.toHaveBeenCalled();
  });

});

describe("U-7 havolasi — buyruq tafsiloti (F3-Q10)", () => {
  test("Mongo ObjectId — havola hex satr bilan tugaydi, metadata bilan bir xil", async () => {
    const oid = new Types.ObjectId("65f0000000000000000abc02");
    await deliverDecision({ ...order, _id: oid }, "basisLost");
    const payload = dispatch.mock.calls[0][0];
    expect(payload.link).toBe("/residency/chetlatish-buyruqlari/65f0000000000000000abc02");
    expect(payload.metadata.orderId).toBe("65f0000000000000000abc02");
  });

  test("expulsionOrderLink — id bo'lsa tafsilot, bo'lmasa ro'yxat", () => {
    expect(expulsionOrderLink("o1")).toBe("/residency/chetlatish-buyruqlari/o1");
    expect(expulsionOrderLink(null)).toBe("/residency/chetlatish-buyruqlari");
    expect(expulsionOrderLink(undefined)).toBe("/residency/chetlatish-buyruqlari");
  });
});

describe("deliverDecision — qabul qiluvchi yo'q", () => {
  test("U-7 va bo'lim xodimi yo'q — belgi QO'YILMAYDI (ertaga qayta)", async () => {
    const { officeUserIds } = require("./officeRecipients");
    officeUserIds.mockResolvedValueOnce([]);
    expect(await deliverDecision(order, "basisLost")).toBe(false);
    expect(markDecisionDelivered).not.toHaveBeenCalled();
  });

  test("OneID bog'lanmagan rezident — yuborilmaydi, belgilanadi (qayta urinish ma'nosiz)", async () => {
    armResident({ user: null });
    expect(await deliverDecision(order, "signed")).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    expect(markDecisionDelivered).toHaveBeenCalledWith("o1", "signed");
  });
});

describe("announceDecisionNotices / basisLostEffects", () => {
  test("har yetkazilmagan qaror — alohida himoyalangan", async () => {
    findUndeliveredDecisions.mockResolvedValueOnce([
      { order: { ...order, _id: "bad" }, kind: "signed" },
      { order, kind: "rejected" },
    ]);
    countDecisionNotices.mockReset().mockRejectedValueOnce(new Error("Mongo down")).mockResolvedValue(1);
    await announceDecisionNotices(new Date("2026-10-05T08:00:00Z"));
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("order=bad"));
    expect(markDecisionDelivered).toHaveBeenCalledWith("o1", "rejected");
  });

  test("U-7 da'vosi yutildi — `basisLostNotice` effekti; yutqazdi — bo'sh", async () => {
    const countHours = jest.fn();
    markSignedBasisLost.mockResolvedValueOnce({ order, hours: 40 }).mockResolvedValueOnce(null);
    expect(await basisLostEffects({ residentId: "r1", source: "cron", countHours })).toEqual([
      { kind: "basisLostNotice", order },
    ]);
    expect(markSignedBasisLost).toHaveBeenCalledWith({ residentId: "r1", source: "cron", countHours });
    expect(await basisLostEffects({ residentId: "r1", source: "cron", countHours })).toEqual([]);
  });

  test("da'vo xatosi — throw YO'Q (davomat yozuvi 400 olmasin)", async () => {
    markSignedBasisLost.mockRejectedValueOnce(new Error("Mongo down"));
    await expect(basisLostEffects({ residentId: "r1", source: "attendance" })).resolves.toEqual([]);
    expect(winston.error).toHaveBeenCalled();
  });
});
