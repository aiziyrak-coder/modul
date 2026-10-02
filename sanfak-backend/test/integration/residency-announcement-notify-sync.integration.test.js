"use strict";

const mongoose = require("mongoose");

const Notification = require("#system/notification/notification.model");
const notify = require("#modules/4.05-residency/_services/announcementNotify");

jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn(),
  dispatchMany: jest.fn(),
  DEFAULT_PREFS: {},
}));
const {
  dispatch,
} = require("#system/notification/notificationDispatcher");

const ANN = new mongoose.Types.ObjectId();
const doc = { _id: ANN, title: "Attestatsiya jadvali" };

const USER_A = new mongoose.Types.ObjectId();
const USER_B = new mongoose.Types.ObjectId();
const USER_C = new mongoose.Types.ObjectId();

const seedEntry = (user, { active = true, read = false, announcement = ANN } = {}) =>
  Notification.create({
    user,
    eventType: notify.EVENT_TYPE,
    title: "Yangi e'lon",
    body: doc.title,
    link: `/residency/elonlar?id=${announcement}`,
    metadata: { announcementId: String(announcement) },
    active,
    read,
  });

const stateOf = async (user) => {
  const row = await Notification.findOne({
    user,
    "metadata.announcementId": String(ANN),
  }).lean();
  return row ? { active: row.active, read: row.read } : null;
};

const persistingDispatch = (p) =>
  Notification.create({
    user: p.userId,
    eventType: p.eventType,
    title: p.title,
    body: p.body,
    link: p.link,
    metadata: p.metadata,
  });

beforeEach(() => {
  dispatch.mockReset();
  dispatch.mockImplementation(persistingDispatch);
});

describe("sync — manzil TORAYSA eskirgan yozuv bekor qilinadi", () => {
  it("endi ko'ra olmaydiganning yozuvi qo'ng'iroqdan yo'qoladi", async () => {
    await seedEntry(USER_A);
    await seedEntry(USER_B);

    const res = await notify.sync(doc, [String(USER_B)]);

    expect(res.revoked).toBe(1);
    expect((await stateOf(USER_A)).active).toBe(false);
    expect((await stateOf(USER_B)).active).toBe(true);
  });

  it("yozuv O'CHIRILMAYDI — audit izi qoladi", async () => {
    await seedEntry(USER_A, { read: true });
    await notify.sync(doc, []);

    const row = await stateOf(USER_A);
    expect(row).not.toBeNull();
    expect(row.active).toBe(false);
    expect(row.read).toBe(true);
  });
});

describe("sync — qamrov KENGAYSA", () => {
  it("yangi qamrab olinganga xabar yuboriladi", async () => {
    await seedEntry(USER_A);

    const res = await notify.sync(doc, [String(USER_A), String(USER_C)]);

    expect(res.created).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: String(USER_C),
        metadata: { announcementId: String(ANN) },
        link: `/residency/elonlar?id=${ANN}`,
      }),
    );
  });

  it("qaytib qamrovga kirgan ESKI yozuv tiriltiriladi, yangisi yaratilmaydi", async () => {
    await seedEntry(USER_A, { active: false, read: true });

    const res = await notify.sync(doc, [String(USER_A)]);

    expect(res.restored).toBe(1);
    expect(res.created).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
    expect(await stateOf(USER_A)).toEqual({ active: true, read: true });
  });
});

describe("sync — idempotentlik va izolyatsiya", () => {
  it("ikki marta chaqirilsa ikkinchisi hech narsa qilmaydi", async () => {
    await seedEntry(USER_A);
    await notify.sync(doc, [String(USER_B)]);
    dispatch.mockClear();

    const second = await notify.sync(doc, [String(USER_B)]);
    expect(second).toEqual({ revoked: 0, restored: 0, created: 0 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("BOSHQA e'lonning yozuvlariga tegmaydi", async () => {
    const other = new mongoose.Types.ObjectId();
    await seedEntry(USER_A, { announcement: other });

    await notify.sync(doc, []);

    const row = await Notification.findOne({
      "metadata.announcementId": String(other),
    }).lean();
    expect(row.active).toBe(true);
  });

  it("boshqa eventType'dagi yozuvga tegmaydi", async () => {
    await Notification.create({
      user: USER_A,
      eventType: "task_assigned",
      title: "Topshiriq",
      metadata: { announcementId: String(ANN) },
      active: true,
    });

    await notify.sync(doc, []);

    const row = await Notification.findOne({ eventType: "task_assigned" }).lean();
    expect(row.active).toBe(true);
  });
});

describe("revokeAll — e'lon o'chirilganda", () => {
  it("barcha faol yozuvlarni bekor qiladi", async () => {
    await seedEntry(USER_A);
    await seedEntry(USER_B);
    await seedEntry(USER_C, { active: false });

    const n = await notify.revokeAll(ANN);

    expect(n).toBe(2);
    expect((await stateOf(USER_A)).active).toBe(false);
    expect((await stateOf(USER_B)).active).toBe(false);
  });

  it("boshqa e'lonnikiga tegmaydi", async () => {
    const other = new mongoose.Types.ObjectId();
    await seedEntry(USER_A, { announcement: other });

    expect(await notify.revokeAll(ANN)).toBe(0);
    const row = await Notification.findOne({
      "metadata.announcementId": String(other),
    }).lean();
    expect(row.active).toBe(true);
  });
});
