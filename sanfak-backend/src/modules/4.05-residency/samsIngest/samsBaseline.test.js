"use strict";

jest.mock("./samsOrgDay.model", () => ({ find: jest.fn() }));
jest.mock("./samsPresence.model", () => ({ aggregate: jest.fn(), find: jest.fn() }));

const mongoose = require("mongoose");
const SamsOrgDay = require("./samsOrgDay.model");
const SamsPresence = require("./samsPresence.model");
const { addDays } = require("./samsContract");
const B = require("./samsBaseline");

const D = (n) => addDays("2026-09-27", n);
const finalAt = (d) => new Date(`${addDays(d, 1)}T01:30:00+05:00`);
const org = (d, over = {}) => ({ dbname: "A", day: d, measured: true, expectedResidents: 10, scannedResidents: 8, packetAt: finalAt(d), ...over });

describe("median va clinicBaseline", () => {
  it("toq va juft namunalar", () => {
    expect(B.median([3, 1, 2])).toBe(2);
    expect(B.median([4, 1, 3, 2])).toBe(2.5);
    expect(B.median([])).toBeNull();
  });

  it("<5 namuna — null; faqat yakuniy, o'lchangan, expected>0, scanned>0, kundan OLDIN, eng yangi 20", () => {
    const base = [-1, -2, -3, -4].map((n) => org(D(n), { scannedResidents: 5 }));
    expect(B.clinicBaseline(base, D(0))).toBeNull();
    const noise = [
      org(D(-5), { packetAt: new Date(`${D(-5)}T12:00:00+05:00`) }),
      org(D(-6), { measured: false }),
      org(D(-7), { expectedResidents: 0, scannedResidents: 0 }),
      org(D(-8), { scannedResidents: 0 }),
      org(D(0), { scannedResidents: 10 }),
    ];
    expect(B.clinicBaseline([...base, ...noise], D(0))).toBeNull();
    expect(B.clinicBaseline([...base, org(D(-9), { scannedResidents: 9 })], D(0))).toBe(0.5);
    const many = Array.from({ length: 25 }, (_v, i) => org(D(-1 - i), { scannedResidents: i < 20 ? 6 : 1 }));
    expect(B.clinicBaseline(many, D(0))).toBe(0.6);
  });
});

describe("coverageStatus", () => {
  it.each([
    ["qator yo'q", null, 0.8, null],
    ["yakuniy emas", org(D(0), { packetAt: new Date(`${D(0)}T09:00:00+05:00`) }), 0.8, "provisional"],
    ["kutilgan 0", org(D(-1), { expectedResidents: 0, scannedResidents: 0 }), 0.8, "empty"],
    ["hech kim skanlamagan", org(D(-1), { scannedResidents: 0 }), 0.8, "zero"],
    ["bazaviy yo'q", org(D(-1)), null, "no_baseline"],
    ["yarmidan past", org(D(-1), { scannedResidents: 3 }), 0.8, "low"],
    ["aynan yarmi — normal", org(D(-1), { scannedResidents: 4 }), 0.8, "normal"],
  ])("%s", (_l, row, base, want) => {
    expect(B.coverageStatus(row, base)).toBe(want);
  });
});

const seq = (pattern) =>
  [...pattern].map((c, i) => ({ day: D(-1 - i), hasRecords: c === "+", eligible: c !== "x" }));

describe("summarizePerson", () => {
  it("seriya: yozuvsiz hisobga olinadigan kunlar; o'lik klinika kuni sanalmaydi va uzmaydi", () => {
    const s = B.summarizePerson(seq("--x-+++++"));
    expect([s.silentStreak, s.lastRecordDay, s.eligibleDays, s.daysWithRecords]).toEqual([3, D(-5), 8, 5]);
  });

  it("baselineRate seriyadan OLDINGI oynada; rate — butun eng yangi 20", () => {
    const s = B.summarizePerson(seq("---+++++"));
    expect(s.baselineRate).toBe(1);
    expect(s.rate).toBe(5 / 8);
    expect(s.suspectSilent).toBe(true);
  });

  it.each([
    ["0.8 va 3 — shubhali", "---++++-", true],
    ["0.8 va 2 — yo'q", "--++++-", false],
    ["0.79 (≈15/19) va 3 — yo'q", `---${"+".repeat(15)}${"-".repeat(4)}`, false],
    ["<5 namuna — baselineRate null", "---++++", false],
  ])("%s", (_l, pattern, want) => {
    expect(B.summarizePerson(seq(pattern)).suspectSilent).toBe(want);
  });

  it("isEligible: klinika o'lik (scanned 0) yoki yakuniy emas — hisobga olinmaydi", () => {
    const p = { dbname: "A", day: D(-1), measured: true, packetAt: finalAt(D(-1)) };
    expect(B.isEligible(p, org(D(-1)))).toBe(true);
    expect(B.isEligible(p, org(D(-1), { scannedResidents: 0 }))).toBe(false);
    expect(B.isEligible(p, org(D(-1), { measured: false }))).toBe(false);
    expect(B.isEligible({ ...p, packetAt: new Date(`${D(-1)}T12:00:00+05:00`) }, org(D(-1)))).toBe(false);
  });
});

describe("personBaselines — o'qish shakli", () => {
  it("ObjectId'ga o'girilgan $in, 45 kun, faqat o'lchangan, yozuvlar `$size` bilan (massiv tashilmaydi)", async () => {
    const id = new mongoose.Types.ObjectId();
    SamsPresence.aggregate.mockResolvedValueOnce([
      { resident: id, day: D(-1), dbname: "A", measured: true, packetAt: finalAt(D(-1)), hasRecords: true },
    ]);
    SamsOrgDay.find.mockReturnValue({ select: () => ({ lean: async () => [org(D(-1))] }) });
    const res = await B.personBaselines([String(id)], { to: D(-1) });
    const [match, project] = SamsPresence.aggregate.mock.calls[0][0];
    expect(match.$match).toEqual({ resident: { $in: [id] }, day: { $gte: D(-46), $lte: D(-1) }, measured: true });
    expect(match.$match.resident.$in[0]).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(project.$project.hasRecords).toEqual({ $gt: [{ $size: { $ifNull: ["$records", []] } }, 0] });
    expect(project.$project.records).toBeUndefined();
    expect(res.get(String(id))).toMatchObject({ eligibleDays: 1, daysWithRecords: 1, silentStreak: 0, lastRecordDay: D(-1) });
  });
});
