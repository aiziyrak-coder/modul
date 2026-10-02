"use strict";

const {
  resolveEntry,
  OUTCOMES,
  REASONS,
  RESOLVER_VERSION,
  RESOLUTION_WINDOW_DAYS,
  sessionRowDate,
  sessionStartInstant,
  sessionEndInstant,
  uzMinutesOf,
} = require("./sessionResolver");
const { FRAME_OUTCOMES } = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");

const DAY = "2026-10-12";
const WIN = { from: "09:00", to: "14:00" };
const uz = (hhmm, day = DAY) => new Date(`${day}T${hhmm}:00.000+05:00`);
const DAY_END = uz("00:00", "2026-10-13");
const AFTER = uz("08:00", "2026-10-13");
const rec = (accessTime, exitTime = null, inDevice = 1, outDevice = 1) => ({ accessTime, exitTime, inDevice, outDevice });
const facts = (records = [], extra = {}) => ({ measured: true, reason: null, dbname: "clinicA", packetAt: DAY_END, records, ...extra });
const resolve = (over = {}) =>
  resolveEntry({ session: { day: DAY }, entry: {}, facts: facts(), outages: [], excuses: [], now: AFTER, fallbackWindow: WIN, ...over });
const withRecords = (records, over = {}) => resolve({ facts: facts(records), ...over });
const pick = (r) => [r.outcome, r.reason];

describe("R1/R2 — void, hatto kesishma bo'lsa ham", () => {
  test("sessiya bekor — void/session_cancelled", () => {
    const r = withRecords([rec("09:10", "13:00")], { session: { day: DAY, cancelled: true } });
    expect(pick(r)).toEqual([OUTCOMES.VOID, REASONS.SESSION_CANCELLED]);
    expect(r.samsFirstIn).toBeNull();
  });

  test("freym chiqarilgan — void/withdrawn", () => {
    expect(pick(withRecords([rec("09:10", "13:00")], { entry: { withdrawn: true } }))).toEqual([OUTCOMES.VOID, REASONS.WITHDRAWN]);
  });
});

describe("R3 — kesishma chegaralari (qat'iy, Q3=A)", () => {
  test.each([
    ["chiqish == boshlanish", rec("08:00", "09:00"), OUTCOMES.ABSENT],
    ["kirish == tugash", rec("14:00", "15:00"), OUTCOMES.ABSENT],
    ["1 daqiqa (boshida)", rec("08:00", "09:01"), OUTCOMES.PRESENT],
    ["1 daqiqa (oxirida)", rec("13:59", "15:00"), OUTCOMES.PRESENT],
    ["butunlay ichida", rec("10:00", "11:00"), OUTCOMES.PRESENT],
    ["butun oynani qoplaydi", rec("07:00", "18:00"), OUTCOMES.PRESENT],
    ["kirish == chiqish, oyna ichida", rec("10:00", "10:00"), OUTCOMES.PRESENT],
  ])("%s", (_label, record, outcome) => {
    expect(withRecords([record]).outcome).toBe(outcome);
  });
});

describe("ochiq yozuv — bugun `now` gacha, o'tgan kun 24:00 gacha", () => {
  test("bugun, `now` sessiya ichida — present", () => {
    expect(withRecords([rec("09:30")], { now: uz("10:00") }).outcome).toBe(OUTCOMES.PRESENT);
  });

  test("bugun, `now` boshlanishdan oldin — hali present EMAS (in_progress)", () => {
    expect(pick(withRecords([rec("08:00")], { now: uz("08:30") }))).toEqual([OUTCOMES.PENDING, REASONS.IN_PROGRESS]);
  });

  test("o'tgan kun, 13:00 da kirgan va chiqmagan — 24:00 gacha → present, juftlik yo'q", () => {
    const r = withRecords([rec("13:00")]);
    expect(r).toMatchObject({ outcome: OUTCOMES.PRESENT, samsFirstIn: "13:00", samsLastOut: null, checkInTime: null, checkOutTime: null });
  });

  test("bugun, kelajak vaqtli kirish e'tiborsiz", () => {
    expect(pick(withRecords([rec("11:00", "12:00")], { now: uz("10:00") }))).toEqual([OUTCOMES.PENDING, REASONS.IN_PROGRESS]);
  });

  test("tungi yozuv (chiqish < kirish, Q2=A) — [kirish, 24:00): present, vaqtlar yo'q", () => {
    expect(withRecords([rec("08:30", "02:00")])).toMatchObject({
      outcome: OUTCOMES.PRESENT, samsFirstIn: "08:30", samsLastOut: null, checkInTime: null, checkOutTime: null,
    });
    expect(withRecords([rec("20:00", "06:00")]).outcome).toBe(OUTCOMES.ABSENT);
  });
});

describe("qurilmalar (D-TURN)", () => {
  test("sintetik chiqish (qurilma 3) — yozuv ochiq: 07:00–08:00 ham oynaga yetadi, checkOut yo'q", () => {
    const r = withRecords([rec("07:00", "08:00", 1, 3)]);
    expect(r).toMatchObject({ outcome: OUTCOMES.PRESENT, samsFirstIn: "07:00", samsLastOut: null, checkOutTime: null });
  });

  test("faqat sintetik kirish — unmeasured/synthetic_only", () => {
    expect(pick(withRecords([rec("09:10", "13:00", 3, 3)]))).toEqual([OUTCOMES.UNMEASURED, REASONS.SYNTHETIC_ONLY]);
  });

  test("qurilmasi noma'lum kirish — unmeasured/unknown_device", () => {
    expect(pick(withRecords([rec("09:10", "13:00", null, null)]))).toEqual([OUTCOMES.UNMEASURED, REASONS.UNKNOWN_DEVICE]);
  });

  test.each([
    ["faqat mobil", [rec("09:10", "13:00", 2, 2)], [2]],
    ["aralash", [rec("09:10", "10:00", 2, 2), rec("11:00", "12:00", 1, 1)], [1, 2]],
    ["haqiqiy + sintetik", [rec("09:10", "10:00", 3, 3), rec("11:00", "12:00", 1, 1)], [1]],
  ])("%s — present, devices", (_label, records, devices) => {
    expect(withRecords(records)).toMatchObject({ outcome: OUTCOMES.PRESENT, devices });
  });

  test("kesishmaydigan sintetik yozuv absent'ni to'smaydi", () => {
    expect(withRecords([rec("15:00", "16:00", 3, 3)]).outcome).toBe(OUTCOMES.ABSENT);
  });
});

describe("R4 — uzilish oynasi faqat absent'ni to'sadi", () => {
  const o = (fromDay, toDay, dbname = null) => ({ fromDay, toDay, dbname });

  test.each([
    ["barcha klinikalar", o(DAY, DAY), OUTCOMES.UNMEASURED],
    ["o'sha klinika", o("2026-10-01", "2026-10-31", "clinicA"), OUTCOMES.UNMEASURED],
    ["boshqa klinika — qo'llanmaydi", o(DAY, DAY, "clinicB"), OUTCOMES.ABSENT],
    ["oldingi kunlar", o("2026-10-01", "2026-10-11"), OUTCOMES.ABSENT],
    ["keyingi kunlar", o("2026-10-13", "2026-10-20"), OUTCOMES.ABSENT],
  ])("%s", (_label, outage, outcome) => {
    const r = resolve({ outages: [outage] });
    expect(r.outcome).toBe(outcome);
    if (outcome === OUTCOMES.UNMEASURED) expect(r.reason).toBe(REASONS.OUTAGE_WINDOW);
  });

  test("present uzilishdan ustun", () => {
    expect(withRecords([rec("09:10", "13:00")], { outages: [o(DAY, DAY)] }).outcome).toBe(OUTCOMES.PRESENT);
  });

  test("fakt yo'q — faqat global oyna qo'llanadi", () => {
    expect(pick(resolve({ facts: null, outages: [o(DAY, DAY)] }))).toEqual([OUTCOMES.UNMEASURED, REASONS.OUTAGE_WINDOW]);
    expect(pick(resolve({ facts: null, outages: [o(DAY, DAY, "clinicA")] }))).toEqual([OUTCOMES.UNMEASURED, REASONS.NO_FACTS]);
  });
});

describe("R5–R9 — kutish va o'lchanmaganlik", () => {
  test("sessiya tugamagan (13:59) — pending/in_progress; tugash lahzasi (14:00) — endi emas", () => {
    expect(pick(resolve({ now: uz("13:59") }))).toEqual([OUTCOMES.PENDING, REASONS.IN_PROGRESS]);
    expect(resolve({ now: uz("14:00") }).outcome).toBe(OUTCOMES.ABSENT);
  });

  test("fakt yo'q — kun yopilguncha pending, keyin unmeasured/no_facts", () => {
    expect(pick(resolve({ facts: null, now: uz("17:00") }))).toEqual([OUTCOMES.PENDING, REASONS.AWAITING_CLOSE]);
    expect(pick(resolve({ facts: null }))).toEqual([OUTCOMES.UNMEASURED, REASONS.NO_FACTS]);
  });

  test("measured:false — sabab o'tadi; sababsiz — tenant_unmeasured", () => {
    expect(pick(resolve({ facts: facts([], { measured: false, reason: "before_horizon" }) }))).toEqual([OUTCOMES.UNMEASURED, "before_horizon"]);
    expect(pick(resolve({ facts: facts([], { measured: false }) }))).toEqual([OUTCOMES.UNMEASURED, REASONS.TENANT_UNMEASURED]);
    expect(pick(resolve({ facts: facts([], { measured: undefined }) }))).toEqual([OUTCOMES.UNMEASURED, REASONS.TENANT_UNMEASURED]);
  });

  test("measured:false, lekin haqiqiy skan — present (R3 R7 dan oldin)", () => {
    expect(withRecords([rec("09:10", "13:00")], { facts: facts([rec("09:10", "13:00")], { measured: false, reason: "stale" }) }).outcome).toBe(OUTCOMES.PRESENT);
  });

  test("packetAt == kun oxiri — absent (>=); 1 ms oldin — pending/unmeasured", () => {
    expect(resolve().outcome).toBe(OUTCOMES.ABSENT);
    const early = facts([], { packetAt: new Date(DAY_END.getTime() - 1) });
    expect(pick(resolve({ facts: early, now: uz("17:00") }))).toEqual([OUTCOMES.PENDING, REASONS.AWAITING_CLOSE]);
    expect(pick(resolve({ facts: early }))).toEqual([OUTCOMES.UNMEASURED, REASONS.NO_CLOSE_PACKET]);
    expect(pick(resolve({ facts: facts([], { packetAt: null }) }))).toEqual([OUTCOMES.UNMEASURED, REASONS.NO_CLOSE_PACKET]);
  });
});

describe("R10 — ariza (sababli)", () => {
  const d = (s) => new Date(`${s}T00:00:00.000Z`);
  const app = (id, from, to) => ({ _id: id, fromDate: d(from), toDate: d(to), reason: "x" });

  test.each([
    ["boshlanish chegarasi", [app("a", DAY, "2026-10-20")], "a"],
    ["tugash chegarasi", [app("a", "2026-10-01", DAY)], "a"],
    ["eng erta yaratilgan yutadi", [app("early", "2026-10-01", "2026-10-31"), app("late", DAY, DAY)], "early"],
    ["qoplamaydi", [app("a", "2026-10-13", "2026-10-20")], null],
  ])("%s", (_label, excuses, expected) => {
    const r = resolve({ excuses });
    expect(r.outcome).toBe(OUTCOMES.ABSENT);
    expect(r.excuse?._id ?? null).toBe(expected);
  });

  test("present — ariza biriktirilmaydi", () => {
    expect(withRecords([rec("09:10", "13:00")], { excuses: [app("a", DAY, DAY)] }).excuse).toBeNull();
  });
});

describe("kechikish va D-TIME vaqtlari", () => {
  test.each([
    ["09:05 — 5 daqiqa", [rec("09:05", "13:00")], [5, "09:05", "13:00"]],
    ["boshlanishdan oldin — kechikmagan", [rec("08:50", "13:00")], [null, "08:50", "13:00"]],
    ["bir necha yozuv — birinchi kirish, oxirgi yopiq chiqish", [rec("09:20", "10:00"), rec("11:00", "13:30")], [20, "09:20", "13:30"]],
  ])("%s", (_label, records, [lateMinutes, checkInTime, checkOutTime]) => {
    expect(withRecords(records)).toMatchObject({ lateMinutes, checkInTime, checkOutTime, samsFirstIn: checkInTime, samsLastOut: checkOutTime });
  });

  test("600 daqiqadan oshsa — 600", () => {
    expect(withRecords([rec("11:00", "12:00")], { fallbackWindow: { from: "00:30", to: "23:00" } }).lateMinutes).toBe(600);
  });

  test("chiqish yo'q — juftlik null, samsFirstIn saqlanadi; kirish == chiqish — juftlik yo'q", () => {
    expect(withRecords([rec("09:10")])).toMatchObject({ samsFirstIn: "09:10", samsLastOut: null, checkInTime: null, checkOutTime: null });
    expect(withRecords([rec("10:00", "10:00")])).toMatchObject({ samsFirstIn: "10:00", samsLastOut: "10:00", checkInTime: null, checkOutTime: null });
  });

});

describe("R8b — o'qib bo'lmaydigan kirish vaqti (D-MODE 1: talqin qilib bo'lmaydi ≠ kelmadi)", () => {
  test.each([
    ["null", rec(null, "13:00")],
    ["bo'sh satr", rec("", "13:00")],
    ["bir xonali soat", rec("9:05", "13:00")],
    ["soniyali", rec("09:05:30", "13:00")],
    ["25:00", rec("25:00", "26:00")],
    ["maydon yo'q", { exitTime: "13:00", inDevice: 1, outDevice: 1 }],
    ["sintetik qurilma ham", rec("9:05", "13:00", 3, 3)],
  ])("%s — unmeasured/unreadable_time, absent emas", (_label, record) => {
    expect(pick(withRecords([record]))).toEqual([OUTCOMES.UNMEASURED, REASONS.UNREADABLE_TIME]);
  });

  test("haqiqiy kesishma bo'lsa — present ustun; kesishmaydigan o'qiladigan yozuv to'siqni olmaydi", () => {
    expect(withRecords([rec("9:30", "12:00"), rec("09:10", "13:00")]).outcome).toBe(OUTCOMES.PRESENT);
    expect(pick(withRecords([rec("9:30", "12:00"), rec("15:00", "16:00")]))).toEqual([OUTCOMES.UNMEASURED, REASONS.UNREADABLE_TIME]);
  });
});

describe("oyna manbai", () => {
  test("sessiyada vaqt yo'q — fallbackWindow; sessiya vaqti bo'lsa — u ustun", () => {
    expect(withRecords([rec("15:00", "16:00")], { fallbackWindow: { from: "14:30", to: "18:00" } }).outcome).toBe(OUTCOMES.PRESENT);
    const own = { session: { day: DAY, startTime: "15:30", endTime: "17:00" } };
    expect(withRecords([rec("15:00", "15:20")], own).outcome).toBe(OUTCOMES.ABSENT);
  });

  test.each([
    ["oyna yo'q", undefined],
    ["from >= to", { from: "14:00", to: "09:00" }],
    ["yaroqsiz satr", { from: "9:00", to: "14:00" }],
  ])("%s — unmeasured/invalid_window (hech qachon absent emas)", (_label, fallbackWindow) => {
    expect(pick(withRecords([rec("09:10", "13:00")], { fallbackWindow }))).toEqual([OUTCOMES.UNMEASURED, REASONS.INVALID_WINDOW]);
  });
});

describe("yordamchilar va konstantalar", () => {
  test("OUTCOMES — roster enumi bilan bir xil to'plam", () => {
    expect(Object.values(OUTCOMES).sort()).toEqual([...FRAME_OUTCOMES].sort());
    expect(RESOLVER_VERSION).toBe(1);
    expect(RESOLUTION_WINDOW_DAYS).toBe(7);
  });

  test("vaqt lahzalari — UZ (UTC+5)", () => {
    expect(sessionRowDate(DAY).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(sessionStartInstant(DAY, "09:00").toISOString()).toBe("2026-10-12T04:00:00.000Z");
    expect(sessionEndInstant(DAY, "14:00").toISOString()).toBe("2026-10-12T09:00:00.000Z");
    expect(sessionEndInstant(DAY, "bad")).toBeNull();
    expect(uzMinutesOf(uz("00:00"))).toBe(0);
    expect(uzMinutesOf(uz("23:59"))).toBe(1439);
  });
});
