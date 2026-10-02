"use strict";

const { buildRows, measure, supersedeFilter } = require("./samsRows");

const DAYS = ["2026-09-25", "2026-09-26", "2026-09-27"];
const EMITTED = new Date("2026-09-27T05:00:00Z");
const RECEIVED = new Date("2026-09-27T05:00:02Z");
const PIN = { r1: "11111111111111", r2: "22222222222222", r3: "33333333333333", x: "99999999999999" };
const rec = (attendId, date) => ({
  attendId, date, accessTime: "08:00", exitTime: "", deviceType: [{ device: 1, type: 1 }], lated: 0, earlyLeft: null,
});
const person = (jshshir, over = {}) => ({
  jshshir, userId: `u-${jshshir.slice(0, 2)}`, hasShift: true, since: "2026-09-01",
  lastActive: "", active: false, records: [], ...over,
});
const tenant = (dbname, people, horizon = "2026-09-01") => ({
  orgId: `o-${dbname}`, dbname, orgTitle: `T ${dbname}`, horizon, people,
  days: DAYS.map((day) => ({
    day, rosterScanCount: 2, expectedResidents: 2, scannedResidents: 1,
    deviceMix: { hikvision: 1, mobile: 1, server: 0, in: 2, out: 0 },
  })),
});
const packet = (tenants, over = {}) => ({ emittedAt: EMITTED, tenants, unresolved: [], ambiguous: [], ...over });
const ids = new Map(Object.entries({ r1: "id1", r2: "id2", r3: "id3" }).map(([k, v]) => [PIN[k], v]));
const build = (p) => buildRows(p, ids, RECEIVED, DAYS);
const rowsOf = (res, resident) => res.presenceRows.filter((r) => r.resident === resident);

describe("measure() — birinchi mos sabab g'olib", () => {
  const base = { day: "2026-09-27", horizon: "2026-09-01", since: "2026-09-01", hasShift: true };
  it.each([
    ["horizon null", { horizon: null }, "before_horizon"],
    ["kun == horizon (ufq kuni o'zi kirmaydi)", { horizon: "2026-09-27" }, "before_horizon"],
    ["kun < horizon", { horizon: "2026-09-28" }, "before_horizon"],
    ["horizon > kun, since null", { since: null }, "before_registration"],
    ["kun == since", { since: "2026-09-27" }, "before_registration"],
    ["smena yo'q", { hasShift: false }, "no_schedule"],
    ["horizon null VA smena yo'q — ufq birinchi", { horizon: null, hasShift: false }, "before_horizon"],
  ])("%s → %s", (_l, over, reason) => {
    expect(measure({ ...base, ...over })).toEqual({ measured: false, reason });
  });

  it("hammasi joyida → measured", () => {
    expect(measure(base)).toEqual({ measured: true, reason: null });
    expect(measure({ ...base, horizon: "2026-09-26", since: "2026-09-26" })).toEqual({ measured: true, reason: null });
  });
});

describe("tenantdagi rezident — har kunga qator", () => {
  const res = build(packet([
    tenant("A", [person(PIN.r1, { records: [rec("a1", "2026-09-27"), rec("a2", "2026-09-25"), rec("a3", "2026-09-27")] }), person(PIN.r2)]),
  ]));

  it("1 tenant × 2 rezident × 3 kun = 6 qator", () => {
    expect(res.presenceRows).toHaveLength(6);
    expect(res.stats).toEqual({ written: 2, unknown: 0, conflicts: 0 });
  });

  it("yozuvsiz kun ham o'lchangan (recordCount 0)", () => {
    const empty = rowsOf(res, "id1").find((r) => r.day === "2026-09-26");
    expect(empty).toMatchObject({ measured: true, unmeasuredReason: null, recordCount: 0, records: [] });
    expect(rowsOf(res, "id2").every((r) => r.measured && r.recordCount === 0)).toBe(true);
  });

  it("yozuvlar sana bo'yicha guruhlanadi, `date` saqlanmaydi, bo'sh vaqt — null", () => {
    const d27 = rowsOf(res, "id1").find((r) => r.day === "2026-09-27");
    expect(d27.recordCount).toBe(2);
    expect(d27.records.map((r) => r.attendId)).toEqual(["a1", "a3"]);
    expect(d27.records[0]).toEqual({
      attendId: "a1", accessTime: "08:00", exitTime: null, deviceType: [{ device: 1, type: 1 }], lated: 0, earlyLeft: null,
    });
  });

  it("xom maydonlar va vaqt belgilari", () => {
    expect(rowsOf(res, "id1")[0]).toMatchObject({
      dbname: "A", samsUserId: "u-11", hasShift: true, samsSince: "2026-09-01", samsUserActive: false,
      lastActive: null, ambiguousDbnames: [], packetAt: EMITTED, receivedAt: RECEIVED,
    });
  });

  it("ro'yxatga olingan kungacha (shu kun ham) — before_registration", () => {
    const r = build(packet([tenant("A", [person(PIN.r1, { since: "2026-09-26" })])]));
    expect(r.presenceRows.map((x) => x.unmeasuredReason)).toEqual(["before_registration", "before_registration", null]);
  });
});

describe("identifikatsiya — unknown, unresolved, ambiguous, conflict", () => {
  it("roster'da yo'q jshshir → unknown++, qator yo'q", () => {
    const r = build(packet([tenant("A", [person(PIN.x)])], { unresolved: [PIN.r3] }));
    expect(r.stats).toEqual({ written: 1, unknown: 1, conflicts: 0 });
    expect(r.presenceRows.every((x) => x.resident === "id3")).toBe(true);
  });

  it("unresolved → har kun `unresolved`, dbname null, yozuvsiz", () => {
    const r = build(packet([], { unresolved: [PIN.r1] }));
    expect(r.presenceRows).toHaveLength(3);
    expect(r.presenceRows[0]).toMatchObject({
      measured: false, unmeasuredReason: "unresolved", dbname: null, records: [], recordCount: 0,
      samsUserId: null, hasShift: null, samsSince: null, samsUserActive: null, lastActive: null,
    });
  });

  it("paketdagi ambiguous → dbname'lar tartiblangan", () => {
    const r = build(packet([], { ambiguous: [{ jshshir: PIN.r1, dbnames: ["Z", "B"] }] }));
    expect(r.presenceRows[0]).toMatchObject({ unmeasuredReason: "ambiguous", ambiguousDbnames: ["B", "Z"] });
  });

  it("bir jshshir A va B tenantlarda → 3 ambiguous qator [A,B], conflicts 1, yozuvlar tashlanadi", () => {
    const r = build(packet([
      tenant("B", [person(PIN.r1, { records: [rec("b1", "2026-09-27")] })]),
      tenant("A", [person(PIN.r1)]),
    ]));
    expect(r.presenceRows).toHaveLength(3);
    expect(r.presenceRows.every((x) => x.unmeasuredReason === "ambiguous" && x.recordCount === 0)).toBe(true);
    expect(r.presenceRows[0].ambiguousDbnames).toEqual(["A", "B"]);
    expect(r.stats).toEqual({ written: 1, unknown: 0, conflicts: 1 });
  });

  it("tenant + unresolved → ambiguous [A]", () => {
    const r = build(packet([tenant("A", [person(PIN.r1)])], { unresolved: [PIN.r1] }));
    expect(r.presenceRows[0]).toMatchObject({ unmeasuredReason: "ambiguous", ambiguousDbnames: ["A"] });
    expect(r.stats.conflicts).toBe(1);
  });
});

describe("klinika × kun qatorlari", () => {
  it("har tenant kuniga bitta qator, ufq (eksklyuziv) bo'yicha o'lchangan", () => {
    const r = build(packet([tenant("A", [], "2026-09-26"), tenant("B", [], null)]));
    expect(r.orgDayRows).toHaveLength(6);
    const a = r.orgDayRows.filter((x) => x.dbname === "A").map((x) => [x.day, x.measured, x.unmeasuredReason]);
    expect(a).toEqual([
      ["2026-09-25", false, "before_horizon"],
      ["2026-09-26", false, "before_horizon"],
      ["2026-09-27", true, null],
    ]);
    expect(r.orgDayRows.filter((x) => x.dbname === "B").every((x) => !x.measured)).toBe(true);
  });

  it("xom sonlar, nom va vaqt belgilari ko'chadi", () => {
    const [row] = build(packet([tenant("A", [])])).orgDayRows;
    expect(row).toMatchObject({
      orgId: "o-A", orgTitle: "T A", horizon: "2026-09-01", rosterScanCount: 2, expectedResidents: 2,
      scannedResidents: 1, deviceMix: { hikvision: 1, mobile: 1, server: 0, in: 2, out: 0 },
      packetAt: EMITTED, receivedAt: RECEIVED,
    });
  });
});

describe("supersedeFilter — qayta yozilmagan qisman qatorlar", () => {
  const lt = (iso) => ({ $lt: new Date(iso) });

  it("javob bergan tenantlar × oyna kunlari, o'lchangan, eskiroq VA o'zi yakuniy bo'lmagan", () => {
    expect(supersedeFilter(packet([tenant("A", []), tenant("B", [])]), DAYS)).toEqual({
      dbname: { $in: ["A", "B"] },
      day: { $in: DAYS },
      measured: true,
      $or: [
        { day: "2026-09-25", packetAt: lt("2026-09-25T19:00:00Z") },
        { day: "2026-09-26", packetAt: lt("2026-09-26T19:00:00Z") },
        { day: "2026-09-27", packetAt: lt("2026-09-27T05:00:00Z") },
      ],
    });
  });

  it("yopilgan kun chegarasi — kun oxiri, `emittedAt` emas (allaqachon yakuniy qator tegilmaydi)", () => {
    const late = packet([tenant("A", [])], { emittedAt: new Date("2026-09-28T20:30:00Z") });
    expect(supersedeFilter(late, ["2026-09-27"]).$or).toEqual([
      { day: "2026-09-27", packetAt: lt("2026-09-27T19:00:00Z") },
    ]);
  });

  it("tenant yo'q (hammasi failedTenants) yoki kun yo'q → null (hech narsa tegilmaydi)", () => {
    expect(supersedeFilter(packet([]), DAYS)).toBeNull();
    expect(supersedeFilter(packet([tenant("A", [])]), [])).toBeNull();
  });
});
