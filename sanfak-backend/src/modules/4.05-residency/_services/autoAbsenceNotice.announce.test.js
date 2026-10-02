"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("#system/notification/notificationDispatcher", () => ({ dispatch: jest.fn() }));
jest.mock("#system/notification/notification.model", () => ({ countDocuments: jest.fn(), updateMany: jest.fn() }));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({ find: jest.fn(), STATUS_IN_STUDY: "oquvda" }));
jest.mock("#modules/4.05-residency/residencyNotice/residencyNotice.model", () => ({
  create: jest.fn(),
  find: jest.fn(),
  distinct: jest.fn(),
  updateOne: jest.fn(),
  exists: jest.fn(),
  NOTICE_KIND_AUTO: "avtomatik",
  AUTO_STATE_ACTIVE: "faol",
  AUTO_STATE_REVOKED: "bekor_qilingan",
  PROGRAMS: ["magistratura", "ordinatura"],
}));
jest.mock("./expulsionDraftData", () => ({ loadDraftResident: jest.fn(), loadDraftRows: jest.fn(), titleOf: jest.fn(), toRow: jest.fn() }));
jest.mock("./officeRecipients", () => ({ officeUserIds: jest.fn() }));
jest.mock("./noticeFiles", () => ({ save: jest.fn() }));
jest.mock("#modules/4.05-residency/_pdf/autoAbsenceNotice.pdf", () => ({
  ...jest.requireActual("#modules/4.05-residency/_pdf/autoAbsenceNotice.pdf"),
  buildAutoAbsenceNoticePdf: jest.fn(),
}));

const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Notification = require("#system/notification/notification.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Notice = require("#modules/4.05-residency/residencyNotice/residencyNotice.model");
const { officeUserIds } = require("./officeRecipients");
const A = require("./autoAbsenceNotice");

const NOW = new Date("2026-10-05T03:00:00Z");
const YEAR = "2026/2027";
const notice = (id = "n1", extra = {}) => ({
  _id: id,
  resident: `r-${id}`,
  auto: { countingYear: YEAR, state: "faol", hoursAtIssue: 6, notifiedAt: null },
  ...extra,
});
const chain = (result) => ({ select: () => ({ lean: async () => result }) });
const CTX = { recipients: ["u1", "u2"], now: NOW, name: "Aliyev Sardor" };

beforeEach(() => {
  jest.resetAllMocks();
  dispatch.mockResolvedValue({});
  Notice.updateOne.mockResolvedValue({ modifiedCount: 1 });
  Notice.exists.mockResolvedValue({ _id: "n1" });
  Notice.distinct.mockResolvedValue([]);
  Notification.countDocuments.mockResolvedValue(2);
  Notification.updateMany.mockResolvedValue({ modifiedCount: 0 });
  officeUserIds.mockResolvedValue(["u1", "u2"]);
});

describe("announceOne — band qilish, yuborish, yakunlash", () => {
  test("yutdi: CAS band qilish, har xodimga ilova ichida, bekor qilinmagan — xabarlar tegilmaydi", async () => {
    await expect(A.announceOne(notice(), { ...CTX, send: dispatch })).resolves.toBe(true);
    expect(Notice.updateOne).toHaveBeenCalledWith(
      { _id: "n1", "auto.state": "faol", "auto.notifiedAt": null },
      { $set: { "auto.notifiedAt": NOW } },
    );
    expect(dispatch).toHaveBeenCalledWith({
      userId: "u1",
      eventType: "residency_absence_notice_auto",
      title: "Davomat bildirgisi (avtomatik)",
      body: "Aliyev Sardor — 2026/2027 o'quv yilida 6 soat sababsiz dars qoldirdi. Tizim bildirgi shakllantirdi — ko'rib chiqing.",
      link: "/residency/bildirgilar?notice=n1",
      metadata: { residentId: "r-n1", noticeId: "n1" },
      overrideChannels: { inApp: true },
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(Notification.countDocuments).toHaveBeenCalledWith({ eventType: "residency_absence_notice_auto", "metadata.noticeId": "n1" });
    expect(Notice.exists).toHaveBeenCalledWith({ _id: "n1", "auto.state": "faol" });
    expect(Notification.updateMany).not.toHaveBeenCalled();
  });

  test("band qilish yutqazildi — hech narsa yuborilmaydi", async () => {
    Notice.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    await expect(A.announceOne(notice(), { ...CTX, send: dispatch })).resolves.toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("bitta xodimga yuborilmadi — qolganlariga ketadi, xato loglanadi", async () => {
    dispatch.mockRejectedValueOnce(new Error("socket"));
    await expect(A.announceOne(notice(), { ...CTX, send: dispatch })).resolves.toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("user=u1 notice=n1: socket"));
  });

});

describe("announceOne — saqlanmaslik va bekor qilish", () => {
  test("hech kimga saqlanmadi — FAQAT o'z band qilishi qaytariladi", async () => {
    Notification.countDocuments.mockResolvedValueOnce(0);
    await expect(A.announceOne(notice(), { ...CTX, send: dispatch })).resolves.toBe(false);
    expect(Notice.updateOne).toHaveBeenLastCalledWith(
      { _id: "n1", "auto.notifiedAt": NOW },
      { $set: { "auto.notifiedAt": null } },
    );
  });

  test("yuborish paytida bekor qilindi — yangi xabarlar darhol olinadi", async () => {
    Notice.exists.mockResolvedValueOnce(null);
    await expect(A.announceOne(notice(), { ...CTX, send: dispatch })).resolves.toBe(true);
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { eventType: "residency_absence_notice_auto", "metadata.noticeId": "n1", active: true },
      { $set: { active: false } },
    );
  });

  test("sanash yiqilsa ham holat qayta o'qiladi (xato yuqoriga)", async () => {
    Notification.countDocuments.mockRejectedValueOnce(new Error("count down"));
    Notice.exists.mockResolvedValueOnce(null);
    await expect(A.announceOne(notice(), { ...CTX, send: dispatch })).rejects.toThrow("count down");
    expect(Notification.updateMany).toHaveBeenCalled();
  });

  test("ism yo'q — «Rezident»", async () => {
    await A.announceOne(notice(), { ...CTX, name: undefined, send: dispatch });
    expect(dispatch.mock.calls[0][0].body).toMatch(/^Rezident — /);
  });
});

describe("announcePending — kimga va qachon", () => {
  test("joriy yil, faol, e'lon qilinmaganlar; jonli ism bilan; bittasining xatosi keyingisini to'xtatmaydi", async () => {
    Notice.find.mockReturnValueOnce(chain([notice("n1"), notice("n2")]));
    Resident.find.mockReturnValueOnce(chain([{ _id: "r-n1", fullName: "Jonli Ism" }]));
    Notice.updateOne.mockRejectedValueOnce(new Error("blip"));
    await expect(A.announcePending(YEAR, NOW, { send: dispatch })).resolves.toBe(1);
    expect(Notice.find).toHaveBeenCalledWith({ kind: "avtomatik", "auto.state": "faol", "auto.countingYear": YEAR, "auto.notifiedAt": null });
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("notice=n1: blip"));
    expect(dispatch.mock.calls.map(([p]) => p.metadata.noticeId)).toEqual(["n2", "n2"]);
    expect(dispatch.mock.calls[0][0].body).toMatch(/^Rezident — /);
  });

  test("hech narsa yo'q — rol so'rovi yo'q; bo'lim bo'sh — hech narsa band qilinmaydi", async () => {
    Notice.find.mockReturnValueOnce(chain([]));
    await expect(A.announcePending(YEAR, NOW)).resolves.toBe(0);
    expect(officeUserIds).not.toHaveBeenCalled();
    Notice.find.mockReturnValueOnce(chain([notice()]));
    officeUserIds.mockResolvedValueOnce([]);
    await expect(A.announcePending(YEAR, NOW)).resolves.toBe(0);
    expect(Notice.updateOne).not.toHaveBeenCalled();
  });
});

describe("syncAbsenceNotices — sweep oxiri", () => {
  test("tartib: bekor qilish → qolgan xabarlarni olish → yaratish → e'lon; yil `now` dan; xulosa logi", async () => {
    Notice.find.mockReturnValue(chain([]));
    Resident.find.mockReturnValue(chain([]));
    await expect(A.syncAbsenceNotices(NOW)).resolves.toEqual({ issued: 0, revoked: 0, announced: 0 });
    const [revokeQuery, announceQuery] = Notice.find.mock.calls.map(([q]) => q);
    expect(revokeQuery).toEqual({ kind: "avtomatik", "auto.state": "faol", "auto.countingYear": YEAR });
    expect(announceQuery).toMatchObject({ "auto.countingYear": YEAR, "auto.notifiedAt": null });
    expect(Notice.distinct).toHaveBeenCalledWith("_id", expect.objectContaining({ "auto.state": "bekor_qilingan" }));
    const order = [
      Notice.find.mock.invocationCallOrder[0],
      Notice.distinct.mock.invocationCallOrder[0],
      Resident.find.mock.invocationCallOrder[0],
      Notice.find.mock.invocationCallOrder[1],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(winston.info).toHaveBeenCalledWith("[4.5 autoAbsenceNotice] avtomatik bildirgilar: yangi 0, bekor 0, e'lon 0");
  });

  test("`send` e'longa uzatiladi; yuqori so'rov xatosi — yuqoriga", async () => {
    const send = jest.fn().mockResolvedValue({});
    Notice.find.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([notice()]));
    Resident.find.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    await expect(A.syncAbsenceNotices(NOW, { send })).resolves.toEqual({ issued: 0, revoked: 0, announced: 1 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(dispatch).not.toHaveBeenCalled();
    Notice.find.mockReturnValueOnce({ select: () => ({ lean: async () => Promise.reject(new Error("Mongo down")) }) });
    await expect(A.syncAbsenceNotices(NOW)).rejects.toThrow("Mongo down");
  });
});
