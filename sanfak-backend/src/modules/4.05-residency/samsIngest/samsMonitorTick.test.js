"use strict";

jest.mock("./samsAlert.model", () => ({ create: jest.fn(), exists: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock("./samsFreshness", () => ({ markStaleDays: jest.fn() }));
jest.mock("./samsPacketLog", () => ({ tenantChanges: jest.fn(), latestPacket: jest.fn() }));
jest.mock("./samsDigest", () => ({ ...jest.requireActual("./samsDigest"), digestContent: jest.fn() }));
jest.mock("#system/notification/notificationDispatcher", () => ({ dispatch: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/officeRecipients", () => ({ officeUserIds: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("#modules/4.05-residency/residencySamsOutage/outageResolution", () => ({ resumePendingResolutions: jest.fn() }));

const mongoose = require("mongoose");
const SamsAlert = require("./samsAlert.model");
const { markStaleDays } = require("./samsFreshness");
const { tenantChanges, latestPacket } = require("./samsPacketLog");
const { digestContent } = require("./samsDigest");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { officeUserIds } = require("#modules/4.05-residency/_services/officeRecipients");
const winston = require("#shared/winston.logger");
const { resumePendingResolutions } = require("#modules/4.05-residency/residencySamsOutage/outageResolution");
const T = require("./samsMonitorTick");

let ready = 1;
Object.defineProperty(mongoose.connection, "readyState", { get: () => ready, configurable: true });

const TEN = new Date("2026-09-27T05:07:00Z");
const dup = () => Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
const content = (over = {}) => ({ today: "2026-09-27", warnings: null, gapKeys: [], last: { receivedAt: TEN }, liveness: "ok", ...over });

beforeEach(() => {
  jest.clearAllMocks();
  ready = 1;
  markStaleDays.mockResolvedValue({ orgDays: 0, presence: 0, todayOrgDays: 0, lost: 0 });
  tenantChanges.mockResolvedValue([]);
  SamsAlert.exists.mockResolvedValue(null);
  SamsAlert.findOne.mockReturnValue({ sort: () => ({ lean: async () => null }) });
  SamsAlert.create.mockResolvedValue({});
  SamsAlert.updateOne.mockResolvedValue({});
  digestContent.mockResolvedValue(content());
  officeUserIds.mockResolvedValue(["u1", "u2"]);
  dispatch.mockResolvedValue({});
  resumePendingResolutions.mockResolvedValue(0);
});

describe("runSamsMonitorTick — qo'riqlar va izolyatsiya", () => {
  it("Mongo ulanmagan — hech bir qadam yo'q, false", async () => {
    ready = 0;
    await expect(T.runSamsMonitorTick(TEN)).resolves.toBe(false);
    expect(markStaleDays).not.toHaveBeenCalled();
  });

  it("oldingi tik ishlayotganda (darvoza) ikkinchisi false va hech narsa qilmaydi", async () => {
    let release;
    markStaleDays.mockReturnValueOnce(new Promise((resolve) => { release = () => resolve({ orgDays: 0, presence: 0 }); }));
    const first = T.runSamsMonitorTick(TEN);
    await expect(T.runSamsMonitorTick(TEN)).resolves.toBe(false);
    expect(markStaleDays).toHaveBeenCalledTimes(1);
    expect(tenantChanges).not.toHaveBeenCalled();
    release();
    await expect(first).resolves.toBe(true);
    await expect(T.runSamsMonitorTick(TEN)).resolves.toBe(true);
  });

  it("yiqilgan qadam qolganlarini to'xtatmaydi; tik false; bitta info qatori", async () => {
    markStaleDays.mockRejectedValueOnce(new Error("Mongo down"));
    await expect(T.runSamsMonitorTick(TEN)).resolves.toBe(false);
    expect(tenantChanges).toHaveBeenCalled();
    expect(SamsAlert.create).toHaveBeenCalled();
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("monitor stale yiqildi: Mongo down"));
    expect(winston.info).toHaveBeenCalledWith(
      expect.stringMatching(/^\[4\.5:SAMS\] monitor stale=error tenants=0 digest=empty liveness=never failed=0 ms=\d+$/),
    );
  });

  it("5-qadam `outages` (I3-Q10): tik vaqti bilan chaqiriladi; yiqilsa tik false, info qatori o'zgarmaydi", async () => {
    await expect(T.runSamsMonitorTick(TEN)).resolves.toBe(true);
    expect(resumePendingResolutions).toHaveBeenCalledWith(TEN);

    resumePendingResolutions.mockRejectedValueOnce(new Error("Mongo down"));
    await expect(T.runSamsMonitorTick(TEN)).resolves.toBe(false);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("monitor outages yiqildi: Mongo down"));
    expect(winston.info).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\[4\.5:SAMS\] monitor stale=0\/0 tenants=0 digest=empty liveness=never failed=0 ms=\d+$/),
    );
  });
});

describe("maybeSendDigest — vaqt va band qilish", () => {
  it("UZ soati: 04:59Z (09:59) — muddat emas; 05:00Z (10:00) — muddat", async () => {
    await expect(T.maybeSendDigest(new Date("2026-09-27T04:59:59Z"))).resolves.toBe("not_due");
    expect(SamsAlert.exists).not.toHaveBeenCalled();
    await expect(T.maybeSendDigest(new Date("2026-09-27T05:00:00Z"))).resolves.toBe("empty");
    expect(SamsAlert.exists).toHaveBeenCalledWith({ key: "digest:2026-09-27" });
  });

  it("bugungi kalit bor — hech narsa hisoblanmaydi", async () => {
    SamsAlert.exists.mockResolvedValueOnce({ _id: "x" });
    await expect(T.maybeSendDigest(TEN)).resolves.toBe("done");
    expect(digestContent).not.toHaveBeenCalled();
  });

  it("bo'sh delta — payload bilan band qilinadi (sent:false), yuborilmaydi, bo'lim so'ralmaydi", async () => {
    digestContent.mockResolvedValueOnce(content({ gapKeys: ["A|2026-09-20"] }));
    SamsAlert.findOne.mockReturnValueOnce({ sort: () => ({ lean: async () => ({ payload: { keys: ["unresolved:1"], gapKeys: ["A|2026-09-20"] } }) }) });
    await expect(T.maybeSendDigest(TEN)).resolves.toBe("empty");
    expect(SamsAlert.create).toHaveBeenCalledWith({
      key: "digest:2026-09-27", kind: "digest", day: "2026-09-27", sent: false,
      payload: { keys: ["unresolved:1"], gapKeys: ["A|2026-09-20"], unreadKeys: [] },
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(officeUserIds).not.toHaveBeenCalled();
  });

  it("E11000 (boshqa tik oldi) — yuborilmaydi", async () => {
    digestContent.mockResolvedValueOnce(content({ gapKeys: ["A|2026-09-20"] }));
    SamsAlert.create.mockRejectedValueOnce(dup());
    await expect(T.maybeSendDigest(TEN)).resolves.toBe("lost");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("bo'lim ro'yxati bo'sh — band qilinmaydi (keyingi tikda qayta)", async () => {
    digestContent.mockResolvedValueOnce(content({ gapKeys: ["A|2026-09-20"] }));
    officeUserIds.mockResolvedValueOnce([]);
    await expect(T.maybeSendDigest(TEN)).resolves.toBe("no_recipients");
    expect(SamsAlert.create).not.toHaveBeenCalled();
  });
});

describe("maybeSendDigest — yuborish", () => {
  it("avval band qilish, keyin har xodimga FAQAT ilova ichida, F4 havolasi, keyin sent:true", async () => {
    digestContent.mockResolvedValueOnce(content({ gapKeys: ["A|2026-09-20", "B|2026-09-21"] }));
    await expect(T.maybeSendDigest(TEN)).resolves.toBe("sent");
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({
      userId: "u1",
      eventType: "residency_sams_digest",
      title: "SAMS davomati — kunlik yig'ma",
      body: "Yetkazilmagan kunlar: 2 (eng eskisi 2026-09-20)",
      link: "/residency/sams-holati",
      metadata: {
        digestDay: "2026-09-27",
        counts: { unresolved: 0, ambiguous: 0, noSchedule: 0, inactiveUser: 0, newWarnings: 0, newGaps: 2, unreadClinics: 0 },
      },
      overrideChannels: { inApp: true },
    });
    const order = [SamsAlert.create, dispatch, SamsAlert.updateOne].map((f) => f.mock.invocationCallOrder[0]);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(SamsAlert.updateOne).toHaveBeenCalledWith({ key: "digest:2026-09-27" }, { $set: { sent: true } });
  });

  it("jonlilik to'xtagan (7 kun ichida) — qator; xodim xatosi boshqasini to'xtatmaydi", async () => {
    digestContent.mockResolvedValueOnce(content({ liveness: "stale", last: { receivedAt: new Date("2026-09-27T03:42:00Z") } }));
    dispatch.mockRejectedValueOnce(new Error("socket"));
    await expect(T.maybeSendDigest(TEN)).resolves.toBe("sent");
    expect(dispatch.mock.calls[1][0].body).toBe("SAMS'dan oxirgi paket: 08:42 — bugungi davomat «o'lchanmagan»");
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("user=u1: socket"));
  });
});

describe("alertTenantChanges", () => {
  const change = (id, from, to) => ({ packetId: id, at: new Date("2026-09-27T04:00:00Z"), from, to, added: [], removed: ["E"] });

  it("o'zgarish yo'q — bo'lim so'ralmaydi", async () => {
    await expect(T.alertTenantChanges(TEN)).resolves.toBe(0);
    expect(tenantChanges).toHaveBeenCalledWith(TEN.getTime() - 24 * 3_600_000);
    expect(officeUserIds).not.toHaveBeenCalled();
  });

  it("har paket o'z kaliti bilan; band qilingani qayta yuborilmaydi", async () => {
    tenantChanges.mockResolvedValueOnce([change("p1", 5, 4), change("p2", 4, 6)]);
    SamsAlert.create.mockResolvedValueOnce({}).mockRejectedValueOnce(dup());
    await expect(T.alertTenantChanges(TEN)).resolves.toBe(1);
    expect(SamsAlert.create.mock.calls.map((c) => c[0].key)).toEqual(["tenants:p1", "tenants:p2"]);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      userId: "u1", eventType: "residency_sams_tenants_changed", link: "/residency/sams-holati",
      title: "SAMS: skanerlanadigan klinikalar soni o'zgardi",
      body: "Oldin 5, hozir 4 (09:00). Klinika turi, faolligi yoki o'chirilgani SAMS administratori bilan tekshirilsin.",
      overrideChannels: { inApp: true },
    });
    expect(dispatch.mock.calls[0][0].metadata).toEqual({ at: change("p1").at, from: 5, to: 4, digestDay: "2026-09-27" });
  });

  it("metadata.digestDay — o'zgarishning UZ kuni (UTC kuni emas), band qilingan kun bilan bir xil", async () => {
    const lateUtc = { ...change("p3", 6, 5), at: new Date("2026-09-26T19:30:00Z") };
    tenantChanges.mockResolvedValueOnce([lateUtc]);
    await expect(T.alertTenantChanges(TEN)).resolves.toBe(1);
    expect(SamsAlert.create.mock.calls[0][0].day).toBe("2026-09-27");
    expect(dispatch.mock.calls[0][0].metadata).toEqual({ at: lateUtc.at, from: 6, to: 5, digestDay: "2026-09-27" });
  });
});

describe("checkLiveness — log holati va warn", () => {
  const packetAt = (minutesAgo, failedTenants = []) => ({ receivedAt: new Date(TEN.getTime() - minutesAgo * 60_000), failedTenants });

  it("paketlar kelayapti, lekin klinikalar o'qilmayapti — warn faqat dbname bilan", async () => {
    latestPacket.mockResolvedValueOnce(packetAt(7, [{ dbname: "A", orgTitle: "Klinika A" }, { dbname: "B", orgTitle: "" }]));
    await expect(T.checkLiveness(TEN)).resolves.toEqual({ state: "ok", failed: 2 });
    expect(winston.warn).toHaveBeenCalledWith("[4.5:SAMS] oxirgi paketda o'qilmagan klinikalar: 2 (A,B)");
  });

  it("to'xtagan (≤7 kun) — warn; 7 kundan eski yoki hech qachon — jim; sog'lom — jim", async () => {
    latestPacket.mockResolvedValueOnce(packetAt(45));
    await expect(T.checkLiveness(TEN)).resolves.toEqual({ state: "stale", failed: 0 });
    expect(winston.warn).toHaveBeenCalledWith("[4.5:SAMS] SAMS paketlari to'xtadi: oxirgi qabul 2026-09-27T04:22:00.000Z");
    winston.warn.mockClear();
    latestPacket.mockResolvedValueOnce(packetAt(7 * 24 * 60 + 1)).mockResolvedValueOnce(null).mockResolvedValueOnce(packetAt(5));
    await expect(T.checkLiveness(TEN)).resolves.toEqual({ state: "stale", failed: 0 });
    await expect(T.checkLiveness(TEN)).resolves.toEqual({ state: "never", failed: 0 });
    await expect(T.checkLiveness(TEN)).resolves.toEqual({ state: "ok", failed: 0 });
    expect(winston.warn).not.toHaveBeenCalled();
  });

  it("chegara: roppa-rosa 7 kun — warn; to'xtagan paketdagi failedTenants sanalmaydi va warn bermaydi", async () => {
    latestPacket.mockResolvedValueOnce(packetAt(7 * 24 * 60));
    await expect(T.checkLiveness(TEN)).resolves.toEqual({ state: "stale", failed: 0 });
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("SAMS paketlari to'xtadi"));
    winston.warn.mockClear();
    latestPacket.mockResolvedValueOnce(packetAt(45, [{ dbname: "A" }]));
    await expect(T.checkLiveness(TEN)).resolves.toEqual({ state: "stale", failed: 0 });
    expect(winston.warn).not.toHaveBeenCalledWith(expect.stringContaining("o'qilmagan klinikalar"));
  });

  it("tik log qatorida jonlilik", async () => {
    latestPacket.mockResolvedValueOnce(packetAt(5, [{ dbname: "A" }]));
    await T.runSamsMonitorTick(TEN);
    expect(winston.info).toHaveBeenCalledWith(expect.stringContaining("digest=empty liveness=ok failed=1 ms="));
  });
});
