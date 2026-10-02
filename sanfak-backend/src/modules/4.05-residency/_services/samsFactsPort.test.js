"use strict";

const mockFind = { presence: jest.fn(), orgDay: jest.fn(), outage: jest.fn() };
const mockChain = (fn) => (...args) => ({ select: () => ({ lean: async () => fn(...args) }) });
jest.mock("#modules/4.05-residency/samsIngest/samsPresence.model", () => ({ find: (...a) => mockChain(mockFind.presence)(...a) }));
jest.mock("#modules/4.05-residency/samsIngest/samsOrgDay.model", () => ({ find: (...a) => mockChain(mockFind.orgDay)(...a) }));
jest.mock("#modules/4.05-residency/residencySamsOutage/residencySamsOutage.model", () => ({
  find: (...a) => mockChain(mockFind.outage)(...a),
}));

const { loadSessionFacts, toFacts, toRecord } = require("./samsFactsPort");
const { resolveEntry } = require("./sessionResolver");
const { countsForAccrual } = require("#modules/4.05-residency/samsIngest/samsDayState");
const { isFinalPacket } = require("#modules/4.05-residency/samsIngest/samsContract");

const DAY = "2026-10-14";
const FINAL = new Date("2026-10-14T19:00:00.000Z");
const PARTIAL = new Date("2026-10-14T18:59:59.000Z");
const presenceRow = (over = {}) => ({
  resident: "r1", day: DAY, dbname: "clinicA", measured: true, unmeasuredReason: null, packetAt: FINAL, records: [], ...over,
});
const orgRow = (over = {}) => ({ dbname: "clinicA", day: DAY, measured: true, unmeasuredReason: null, packetAt: FINAL, ...over });
const scan = (accessTime, exitTime, deviceType) => ({ attendId: "a", accessTime, exitTime, deviceType });

beforeEach(() => {
  jest.clearAllMocks();
  mockFind.presence.mockReturnValue([]);
  mockFind.orgDay.mockReturnValue([]);
  mockFind.outage.mockReturnValue([]);
});

describe("measured — qat'iy, ikkala qator (L4-Q22)", () => {
  test.each([
    ["ikkalasi true", presenceRow(), orgRow(), { measured: true, reason: null }],
    ["klinika qatori yo'q", presenceRow(), null, { measured: false, reason: null }],
    ["klinika ufqdan oldin", presenceRow(), orgRow({ measured: false, unmeasuredReason: "before_horizon" }), { measured: false, reason: "before_horizon" }],
    ["klinika eskirgan", presenceRow(), orgRow({ measured: false, unmeasuredReason: "stale" }), { measured: false, reason: "stale" }],
    ["rezident smenasiz", presenceRow({ measured: false, unmeasuredReason: "no_schedule" }), orgRow(), { measured: false, reason: "no_schedule" }],
    ["rezident unresolved", presenceRow({ measured: false, unmeasuredReason: "unresolved", dbname: null }), null, { measured: false, reason: "unresolved" }],
    ["rezident 1 (boolean emas)", presenceRow({ measured: 1 }), orgRow(), { measured: false, reason: null }],
    ["klinika \"true\" (satr)", presenceRow(), orgRow({ measured: "true" }), { measured: false, reason: null }],
  ])("%s", (_l, row, org, want) => {
    expect(toFacts(row, org)).toMatchObject(want);
  });
});

describe("packetAt — faqat countsForAccrual (isFinalRow)", () => {
  test.each([
    ["ikkalasi yakuniy", presenceRow(), orgRow(), FINAL],
    ["ikkalasi yakuniy, kichigi olinadi", presenceRow({ packetAt: new Date(FINAL.getTime() + 5000) }), orgRow(), FINAL],
    ["klinika qisman", presenceRow(), orgRow({ packetAt: PARTIAL }), null],
    ["rezident qatori qisman (eski, qayta yozilmagan)", presenceRow({ packetAt: PARTIAL }), orgRow(), null],
    ["boshqa klinika qatori", presenceRow(), orgRow({ dbname: "clinicB" }), null],
    ["o'lchanmagan (yakuniy bo'lsa ham)", presenceRow({ measured: false, unmeasuredReason: "stale" }), orgRow(), null],
    ["klinika qatori yo'q", presenceRow(), null, null],
  ])("%s", (_l, row, org, want) => {
    expect(toFacts(row, org).packetAt).toEqual(want);
  });

  test("paritet: resolverning yopiq-o'lchangan sharti ≡ countsForAccrual", () => {
    const rows = [presenceRow(), presenceRow({ packetAt: PARTIAL }), presenceRow({ measured: false }), presenceRow({ dbname: "clinicB" })];
    const orgs = [orgRow(), orgRow({ packetAt: PARTIAL }), orgRow({ measured: false }), null];
    for (const row of rows) {
      for (const org of orgs) {
        const f = toFacts(row, org);
        expect([f.measured === true && isFinalPacket(f.packetAt, DAY)]).toEqual([countsForAccrual(row, org)]);
      }
    }
  });
});

describe("yozuv — qurilma va vaqt (I3-Q3, R8b)", () => {
  test.each([
    ["turniket kirish", [{ device: 1, type: 1 }], 1, null],
    ["mobil kirish + turniket chiqish", [{ device: 2, type: 1 }, { device: 1, type: 2 }], 2, 1],
    ["bir necha chiqish — OXIRGISI (cron 23:59)", [{ device: 1, type: 1 }, { device: 1, type: 2 }, { device: 3, type: 2 }], 1, 3],
    ["cron 00:00 kirish (sintetik)", [{ device: 3, type: 1 }], 3, null],
    ["bir necha kirish — BIRINCHISI (sintetik 00:00, keyin turniket)", [{ device: 3, type: 1 }, { device: 1, type: 1 }, { device: 1, type: 2 }], 3, 1],
    ["qurilma null", [{ device: null, type: 1 }], null, null],
    ["qurilma satr", [{ device: "1", type: 1 }], null, null],
    ["turi noma'lum", [{ device: 1, type: 7 }], null, null],
    ["bo'sh", [], null, null],
    ["deviceType yo'q", undefined, null, null],
  ])("%s", (_l, deviceType, inDevice, outDevice) => {
    expect(toRecord(scan("09:05", "13:00", deviceType))).toEqual({ accessTime: "09:05", exitTime: "13:00", inDevice, outDevice });
  });

  test("vaqt XOM uzatiladi (\"9:05\" ham), satr bo'lmagani — null", () => {
    expect(toRecord(scan("9:05", 1300, []))).toMatchObject({ accessTime: "9:05", exitTime: null });
  });
});

describe("resolver bilan birga — port xulosa chiqarmaydi", () => {
  const NOW = new Date("2026-10-15T07:00:00.000Z");
  const resolve = (row, org = orgRow()) =>
    resolveEntry({ session: { day: DAY }, entry: {}, facts: toFacts(row, org), outages: [], excuses: [], now: NOW, fallbackWindow: { from: "09:00", to: "14:00" } });

  test.each([
    ["o'lchangan, yopiq, yozuvsiz", presenceRow(), orgRow(), { outcome: "absent", reason: "no_overlap" }],
    ["klinika qisman (kun yopilmagan)", presenceRow(), orgRow({ packetAt: PARTIAL }), { outcome: "unmeasured", reason: "no_close_packet" }],
    ["smenasiz", presenceRow({ measured: false, unmeasuredReason: "no_schedule" }), orgRow(), { outcome: "unmeasured", reason: "no_schedule" }],
    ["faqat cron yozuvi", presenceRow({ records: [scan("00:00", null, [{ device: 3, type: 1 }])] }), orgRow(), { outcome: "unmeasured", reason: "synthetic_only" }],
    ["o'qib bo'lmaydigan kirish vaqti", presenceRow({ records: [scan("9:05", "13:00", [{ device: 1, type: 1 }])] }), orgRow(), { outcome: "unmeasured", reason: "unreadable_time" }],
    ["qurilmasi null kirish", presenceRow({ records: [scan("09:05", "13:00", [{ device: null, type: 1 }])] }), orgRow(), { outcome: "unmeasured", reason: "unknown_device" }],
  ])("%s", (_l, row, org, want) => {
    expect(resolve(row, org)).toMatchObject(want);
  });

  test("haqiqiy kirish/chiqish — present, to'liq juftlik", () => {
    const row = presenceRow({ records: [scan("08:30", "09:30", [{ device: 1, type: 1 }, { device: 1, type: 2 }])] });
    expect(resolve(row)).toMatchObject({ outcome: "present", checkInTime: "08:30", checkOutTime: "09:30" });
  });
});

describe("loadSessionFacts — so'rovlar va chiqish", () => {
  test("bitta presence, bitta orgDay (noyob dbname'lar), faol uzilishlar", async () => {
    mockFind.presence.mockReturnValue([presenceRow(), presenceRow({ resident: "r2" }), presenceRow({ resident: "r3", dbname: null, measured: false })]);
    mockFind.orgDay.mockReturnValue([orgRow()]);
    mockFind.outage.mockReturnValue([{ from: "2026-10-10", to: DAY, dbname: null }]);
    const out = await loadSessionFacts({ day: DAY, residentIds: ["r1", "r2", "r3", "r4"] });

    expect(mockFind.presence).toHaveBeenCalledWith({ day: DAY, resident: { $in: ["r1", "r2", "r3", "r4"] } });
    expect(mockFind.orgDay).toHaveBeenCalledWith({ day: DAY, dbname: { $in: ["clinicA"] } });
    expect(mockFind.outage).toHaveBeenCalledWith({ cancelledAt: null, from: { $lte: DAY }, to: { $gte: DAY } });
    expect([...out.presence.keys()]).toEqual(["r1", "r2", "r3"]);
    expect(out.presence.get("r1")).toMatchObject({ measured: true, dbname: "clinicA", packetAt: FINAL });
    expect(out.presence.get("r3")).toMatchObject({ measured: false, dbname: null, packetAt: null });
    expect(out.outages).toEqual([{ fromDay: "2026-10-10", toDay: DAY, dbname: null }]);
  });

  test("dbname'siz qatorlar — orgDay so'rovi yo'q", async () => {
    mockFind.presence.mockReturnValue([presenceRow({ dbname: null, measured: false, unmeasuredReason: "ambiguous" })]);
    await loadSessionFacts({ day: DAY, residentIds: ["r1"] });
    expect(mockFind.orgDay).not.toHaveBeenCalled();
  });

  test.each([
    ["yaroqsiz kun", { day: "2026-02-30", residentIds: ["r1"] }],
    ["bo'sh ro'yxat", { day: DAY, residentIds: [] }],
    ["argumentsiz", undefined],
  ])("%s — bazaga murojaat yo'q, bo'sh natija", async (_l, query) => {
    const out = await loadSessionFacts(query);
    expect(out.presence.size).toBe(0);
    expect(out.outages).toEqual([]);
    expect(mockFind.presence).not.toHaveBeenCalled();
    expect(mockFind.outage).not.toHaveBeenCalled();
  });
});
