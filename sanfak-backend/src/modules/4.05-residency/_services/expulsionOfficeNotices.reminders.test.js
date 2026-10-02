"use strict";

jest.mock("#modules/4.05-residency/resident/resident.model", () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock("#system/notification/notificationDispatcher", () => ({ dispatch: jest.fn().mockResolvedValue({}) }));
jest.mock("./officeRecipients", () => ({ officeUserIds: jest.fn() }));
jest.mock("./expulsionReversal", () => ({
  countDecisionNotices: jest.fn(),
  reminderRecipients: jest.fn(),
  supersedeReminders: jest.fn().mockResolvedValue(0),
}));
jest.mock("./expulsionOrderLifecycle", () => ({
  findUndeliveredDecisions: jest.fn().mockResolvedValue([]),
  markDecisionDelivered: jest.fn(),
  findDueReminders: jest.fn(),
  moveReminderStage: jest.fn(),
  settleDraftNotices: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("./autoAbsenceNotice", () => ({ syncAbsenceNotices: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Resident = require("#modules/4.05-residency/resident/resident.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { officeUserIds } = require("./officeRecipients");
const { reminderRecipients, supersedeReminders } = require("./expulsionReversal");
const L = require("./expulsionOrderLifecycle");
const winston = require("#shared/winston.logger");
const { syncAbsenceNotices } = require("./autoAbsenceNotice");
const N = require("./expulsionOfficeNotices");

const NOW = new Date("2031-10-08T03:00:00Z");
const item = (id, extra = {}) => ({
  order: { _id: id, resident: `r-${id}`, residentName: "Snapshot Ism", origin: "tizim", remindedStage: 1, ...extra },
  stage: 2,
  days: 7,
});
const residents = (list) => Resident.find.mockReturnValue({ select: () => ({ lean: async () => list }) });
const live = (id, extra = {}) => ({ _id: `r-${id}`, status: "oquvda", active: true, fullName: `Jonli ${id}`, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  L.findDueReminders.mockResolvedValue([item("o1")]);
  L.moveReminderStage.mockResolvedValue(true);
  residents([live("o1")]);
  officeUserIds.mockResolvedValue(["u1", "u2"]);
  reminderRecipients.mockResolvedValue(["u1", "u2"]);
  syncAbsenceNotices.mockResolvedValue({ issued: 0, revoked: 0, announced: 0 });
});

describe("remindOpenDrafts — kim va qachon", () => {
  test("muddati kelgan loyiha yo'q — rezident, rol va yuborish so'rovi YO'Q", async () => {
    L.findDueReminders.mockResolvedValueOnce([]);
    await expect(N.remindOpenDrafts(NOW)).resolves.toBe(0);
    expect(L.findDueReminders).toHaveBeenCalledWith(NOW);
    expect(Resident.find).not.toHaveBeenCalled();
    expect(officeUserIds).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(winston.info).toHaveBeenCalledWith(expect.stringContaining("0/0"));
  });

  test("bo'lim qaror qila olmaydigan loyihalar band qilinmaydi; ta'tildagi `meros` qoladi", async () => {
    L.findDueReminders.mockResolvedValueOnce([
      item("gone"), item("inactive"), item("leave"), item("expelled"), item("meros", { origin: "meros" }),
    ]);
    residents([live("inactive", { active: false }), live("leave", { status: "akademik_tatil" }),
      live("expelled", { status: "chetlatilgan" }), live("meros", { status: "akademik_tatil" })]);
    await expect(N.remindOpenDrafts(NOW)).resolves.toBe(1);
    expect(L.moveReminderStage.mock.calls.map((c) => c[0])).toEqual(["meros"]);
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("4 ta loyiha"));
  });

  test("bo'lim ro'yxati bo'sh — hech narsa band qilinmaydi (ertaga qayta)", async () => {
    officeUserIds.mockResolvedValueOnce([]);
    await expect(N.remindOpenDrafts(NOW)).resolves.toBe(0);
    expect(L.moveReminderStage).not.toHaveBeenCalled();
  });

  test("qabul qiluvchilar bir marta o'qiladi; bitta loyiha xatosi keyingisini to'xtatmaydi", async () => {
    L.findDueReminders.mockResolvedValueOnce([item("o1"), item("o2")]);
    residents([live("o1"), live("o2")]);
    L.moveReminderStage.mockRejectedValueOnce(new Error("Mongo down"));
    await expect(N.remindOpenDrafts(NOW)).resolves.toBe(1);
    expect(officeUserIds).toHaveBeenCalledTimes(1);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("order=o1"));
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  test("so'rov yiqilsa — xato yuqoriga (sweep natijasi `false`)", async () => {
    L.findDueReminders.mockRejectedValueOnce(new Error("Mongo down"));
    await expect(N.remindOpenDrafts(NOW)).rejects.toThrow("Mongo down");
  });
});

describe("remindOne — band qilish, yuborish, belgi", () => {
  const ctx = { recipients: ["u1", "u2"] };

  test("yutdi: har xodimga ilova ichida, 0-kun turi bilan; tartib saqlangan", async () => {
    const it2 = { ...item("o1"), resident: live("o1") };
    await expect(N.remindOne(it2, ctx)).resolves.toBe(true);
    expect(L.moveReminderStage).toHaveBeenCalledWith("o1", 1, 2);
    expect(dispatch).toHaveBeenCalledWith({
      userId: "u1",
      eventType: "residency_expulsion_draft_office",
      title: "Eslatma: chetlatish buyrug'i loyihasi qaror kutmoqda",
      body: "Jonli o1 — chetlatish buyrug'i loyihasi 7 kundan beri bo'lim qarorini (imzolash yoki rad etish) kutmoqda.",
      link: "/residency/chetlatish-buyruqlari",
      metadata: { residentId: "r-o1", orderId: "o1", reminderStage: 2 },
      overrideChannels: { inApp: true },
    });
    expect(supersedeReminders).toHaveBeenCalledWith("o1", 2, ["u1", "u2"]);
    expect(L.settleDraftNotices).toHaveBeenCalledWith("r-o1", "o1");
    const order = [L.moveReminderStage, dispatch, reminderRecipients, supersedeReminders, L.settleDraftNotices]
      .map((fn) => fn.mock.invocationCallOrder[0]);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("band qilish yutqazildi (shu orada yopildi yoki boshqa sweep oldi) — hech narsa yuborilmaydi", async () => {
    L.moveReminderStage.mockResolvedValueOnce(false);
    await expect(N.remindOne(item("o1"), ctx)).resolves.toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(supersedeReminders).not.toHaveBeenCalled();
  });

  test("hech kimga saqlanmadi — band qilish QAYTARILADI, eski bosqich tegilmaydi", async () => {
    reminderRecipients.mockResolvedValueOnce([]);
    await expect(N.remindOne(item("o1"), ctx)).resolves.toBe(false);
    expect(L.moveReminderStage).toHaveBeenLastCalledWith("o1", 2, 1);
    expect(supersedeReminders).not.toHaveBeenCalled();
  });


  test("ism: jonli → snapshot → «Rezident»; birinchi eslatmada `from` — `null`", async () => {
    await N.remindOne(item("o1", { remindedStage: undefined }), ctx);
    expect(L.moveReminderStage).toHaveBeenCalledWith("o1", null, 2);
    expect(dispatch.mock.calls[0][0].body).toMatch(/^Snapshot Ism — /);
    await N.remindOne(item("o2", { residentName: null }), ctx);
    expect(dispatch.mock.calls.at(-1)[0].body).toMatch(/^Rezident — /);
  });
});

describe("remindOne — qisman saqlash va xato yo'llari", () => {
  const ctx = { recipients: ["u1", "u2"] };

  test("qisman saqlandi — eski bosqich faqat saqlanganlarda olinadi", async () => {
    reminderRecipients.mockResolvedValueOnce(["u1"]);
    await expect(N.remindOne(item("o1"), ctx)).resolves.toBe(true);
    expect(supersedeReminders).toHaveBeenCalledWith("o1", 2, ["u1"]);
  });

  test("keyingi qadam yiqilsa ham `settleDraftNotices` chaqiriladi", async () => {
    supersedeReminders.mockRejectedValueOnce(new Error("blip"));
    await expect(N.remindOne(item("o1"), ctx)).rejects.toThrow("blip");
    expect(L.settleDraftNotices).toHaveBeenCalledWith("r-o1", "o1");
    reminderRecipients.mockResolvedValueOnce([]);
    await N.remindOne(item("o2"), ctx);
    expect(L.settleDraftNotices).toHaveBeenLastCalledWith("r-o2", "o2");
  });
});

describe("announceOfficeFollowUps — sweep yakuni", () => {
  test("sweep yiqilgan (`false`) — faqat qaror xabarlari, eslatma YO'Q", async () => {
    await N.announceOfficeFollowUps(false, NOW);
    expect(L.findUndeliveredDecisions).toHaveBeenCalledWith(NOW);
    expect(L.findDueReminders).not.toHaveBeenCalled();
  });

  test("muvaffaqiyatli — qarorlardan KEYIN eslatmalar", async () => {
    await N.announceOfficeFollowUps(true, NOW);
    expect(L.findDueReminders.mock.invocationCallOrder[0]).toBeGreaterThan(
      L.findUndeliveredDecisions.mock.invocationCallOrder[0],
    );
  });

  test("qarorlar yiqilsa ham eslatmalar ketadi; xato yuqoriga", async () => {
    L.findUndeliveredDecisions.mockRejectedValueOnce(new Error("decisions down"));
    await expect(N.announceOfficeFollowUps(true, NOW)).rejects.toThrow("decisions down");
    expect(L.moveReminderStage).toHaveBeenCalled();
  });

  test("eslatmalar yiqilsa — xato yuqoriga", async () => {
    L.findDueReminders.mockRejectedValueOnce(new Error("reminders down"));
    await expect(N.announceOfficeFollowUps(true, NOW)).rejects.toThrow("reminders down");
  });

  test("ikkalasi yiqilsa — ikkala xato ham loglanadi, birinchisi yuqoriga", async () => {
    L.findUndeliveredDecisions.mockRejectedValueOnce(new Error("decisions down"));
    L.findDueReminders.mockRejectedValueOnce(new Error("reminders down"));
    await expect(N.announceOfficeFollowUps(true, NOW)).rejects.toThrow("decisions down");
    const logged = winston.error.mock.calls.map(([m]) => m).join("\n");
    expect(logged).toMatch(/decisions down/);
    expect(logged).toMatch(/reminders down/);
  });
});

describe("announceOfficeFollowUps — avtomatik bildirgilar (P10)", () => {
  test("sweep yiqilgan (`false`) — avtomatik bildirgilar YO'Q", async () => {
    await N.announceOfficeFollowUps(false, NOW);
    expect(syncAbsenceNotices).not.toHaveBeenCalled();
  });

  test("muvaffaqiyatli — o'sha `now` bilan, eslatmalardan KEYIN", async () => {
    await N.announceOfficeFollowUps(true, NOW);
    expect(syncAbsenceNotices).toHaveBeenCalledWith(NOW);
    expect(syncAbsenceNotices.mock.invocationCallOrder[0]).toBeGreaterThan(L.findDueReminders.mock.invocationCallOrder[0]);
  });

  test("yiqilsa — loglanadi va yuqoriga; qaror xabarlari va eslatmalar baribir ishladi", async () => {
    syncAbsenceNotices.mockRejectedValueOnce(new Error("auto down"));
    await expect(N.announceOfficeFollowUps(true, NOW)).rejects.toThrow("auto down");
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("avtomatik bildirgilar yiqildi: auto down"));
    expect(L.findUndeliveredDecisions).toHaveBeenCalled();
    expect(L.moveReminderStage).toHaveBeenCalled();
  });

  test("oldingi bosqich yiqilsa ham avtomatik bildirgilar ishlaydi; birinchi xato yuqoriga", async () => {
    L.findDueReminders.mockRejectedValueOnce(new Error("reminders down"));
    await expect(N.announceOfficeFollowUps(true, NOW)).rejects.toThrow("reminders down");
    expect(syncAbsenceNotices).toHaveBeenCalledWith(NOW);
  });
});
