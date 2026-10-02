"use strict";

const { resolveEntry, OUTCOMES, dayEndInstant } = require("./sessionResolver");
const { nextDayStartMs, isFinalPacket } = require("#modules/4.05-residency/samsIngest/samsContract");

const DAY = "2026-10-12";
const WIN = { from: "09:00", to: "14:00" };
const uz = (hhmm, day = DAY) => new Date(`${day}T${hhmm}:00.000+05:00`);
const DAY_END = uz("00:00", "2026-10-13");
const rec = (accessTime, exitTime, inDevice) => ({ accessTime, exitTime, inDevice, outDevice: inDevice });

const BLOCKERS = {
  noFacts: (i) => ({ ...i, facts: null }),
  unmeasured: (i) => ({ ...i, facts: i.facts && { ...i.facts, measured: false, reason: "stale" } }),
  measuredMissing: (i) => ({ ...i, facts: i.facts && { ...i.facts, measured: undefined } }),
  notFinal: (i) => ({ ...i, facts: i.facts && { ...i.facts, packetAt: new Date(DAY_END.getTime() - 1) } }),
  outage: (i) => ({ ...i, outages: [{ fromDay: DAY, toDay: DAY, dbname: null }] }),
  notEnded: (i) => ({ ...i, now: uz("13:00") }),
  syntheticOverlap: (i) => ({ ...i, facts: i.facts && { ...i.facts, records: [...i.facts.records, rec("09:30", "12:00", 3)] } }),
  unknownDevice: (i) => ({ ...i, facts: i.facts && { ...i.facts, records: [...i.facts.records, rec("09:30", "12:00", null)] } }),
  unreadableTime: (i) => ({ ...i, facts: i.facts && { ...i.facts, records: [...i.facts.records, rec("9:05", "12:00", 1)] } }),
  cancelled: (i) => ({ ...i, session: { ...i.session, cancelled: true } }),
  withdrawn: (i) => ({ ...i, entry: { withdrawn: true } }),
};
const NAMES = Object.keys(BLOCKERS);

const RECORD_SETS = {
  none: [],
  outsideReal: [rec("15:00", "16:00", 1)],
  outsideSynthetic: [{ accessTime: "00:00", exitTime: "08:00", inDevice: 3, outDevice: 1 }],
};
const cleanInput = (records) => ({
  session: { day: DAY },
  entry: {},
  facts: { measured: true, reason: null, dbname: "clinicA", packetAt: DAY_END, records },
  outages: [],
  excuses: [],
  now: uz("08:00", "2026-10-13"),
  fallbackWindow: WIN,
});

function* subsets() {
  for (let mask = 1; mask < 1 << NAMES.length; mask += 1) yield NAMES.filter((_, i) => mask & (1 << i));
}

describe("D-MODE 1 — absent faqat R10 dan", () => {
  test.each(Object.keys(RECORD_SETS))("to'siqsiz toza holat (%s) — absent", (set) => {
    expect(resolveEntry(cleanInput(RECORD_SETS[set])).outcome).toBe(OUTCOMES.ABSENT);
  });

  test.each(Object.keys(RECORD_SETS))("har to'siq kombinatsiyasi (%s) — hech qachon absent emas", (set) => {
    let checked = 0;
    for (const combo of subsets()) {
      const input = combo.reduce((acc, name) => BLOCKERS[name](acc), cleanInput(RECORD_SETS[set]));
      const { outcome } = resolveEntry(input);
      if (outcome === OUTCOMES.ABSENT) throw new Error(`absent chiqdi: ${combo.join("+")}`);
      checked += 1;
    }
    expect(checked).toBe(2 ** NAMES.length - 1);
  });

  test.each([undefined, null, "true", 1, "yes", {}])("`measured` qat'iy `true` emas (%p) — hech qachon absent emas", (measured) => {
    for (const records of Object.values(RECORD_SETS)) {
      const input = cleanInput(records);
      const r = resolveEntry({ ...input, facts: { ...input.facts, measured } });
      expect([r.outcome, r.reason]).toEqual([OUTCOMES.UNMEASURED, "tenant_unmeasured"]);
    }
  });

  test("haqiqiy kesishma bor — to'siqlarning hech biri absent bermaydi, bekor/chiqarilgandan tashqari present", () => {
    for (const combo of subsets()) {
      const input = combo.reduce((acc, name) => BLOCKERS[name](acc), cleanInput([rec("09:10", "13:00", 1)]));
      const { outcome } = resolveEntry(input);
      expect(outcome).not.toBe(OUTCOMES.ABSENT);
      const voided = combo.includes("cancelled") || combo.includes("withdrawn");
      const noEvidence = combo.includes("noFacts");
      if (!voided && !noEvidence) expect(outcome).toBe(OUTCOMES.PRESENT);
    }
  });
});

describe("FINAL pariteti — `samsContract` bilan yagona ta'rif", () => {
  test.each(["2026-09-01", "2026-10-12", "2026-12-31", "2027-02-28", "2027-08-31"])("%s", (day) => {
    const end = dayEndInstant(day);
    expect(end.getTime()).toBe(nextDayStartMs(day));
    expect(isFinalPacket(end, day)).toBe(true);
    expect(isFinalPacket(new Date(end.getTime() - 1), day)).toBe(false);
  });

  test("resolver chegarasi — isFinalPacket bilan bir xil nuqtada o'tadi", () => {
    const at = (packetAt) => resolveEntry({ ...cleanInput([]), facts: { ...cleanInput([]).facts, packetAt } }).outcome;
    expect(at(DAY_END)).toBe(OUTCOMES.ABSENT);
    expect(at(new Date(DAY_END.getTime() - 1))).toBe(OUTCOMES.UNMEASURED);
  });
});
