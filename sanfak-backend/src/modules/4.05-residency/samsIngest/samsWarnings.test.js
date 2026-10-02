"use strict";

jest.mock("#modules/4.05-residency/resident/resident.model", () => ({ find: jest.fn() }));
jest.mock("./samsPresence.model", () => ({ find: jest.fn(), aggregate: jest.fn() }));
jest.mock("./samsOrgDay.model", () => ({ distinct: jest.fn(), find: jest.fn() }));

const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsPresence = require("./samsPresence.model");
const SamsOrgDay = require("./samsOrgDay.model");
const W = require("./samsWarnings");

const DAY = "2026-09-27";
const chain = (docs) => ({ select: () => ({ lean: async () => docs }) });
const TITLES = new Map([["A", "Klinika A"], ["B", "Klinika B"]]);
const row = (resident, over) => ({ resident, dbname: null, unmeasuredReason: null, samsUserActive: null, ambiguousDbnames: [], ...over });
const person = (id) => ({ _id: id, fullName: `Ism ${id}`, jshshir: `3010199000${id.padStart(4, "0")}` });

beforeEach(() => {
  jest.clearAllMocks();
  SamsOrgDay.distinct.mockResolvedValue(["A", "B"]);
});

describe("referenceDay", () => {
  it("bugun bo'lsa — bugun; aks holda bugungacha eng yangisi; yo'q — null", () => {
    expect(W.referenceDay(DAY, [{ day: "2026-09-25" }, { day: DAY }, { day: "2026-09-28" }])).toBe(DAY);
    expect(W.referenceDay(DAY, [{ day: "2026-09-25" }, { day: "2026-09-26" }])).toBe("2026-09-26");
    expect(W.referenceDay(DAY, [{ day: "2026-09-28" }])).toBeNull();
    expect(W.referenceDay(DAY, [])).toBeNull();
  });
});

function seedFlagged() {
  SamsPresence.find.mockReturnValue(chain([
    row("1", { unmeasuredReason: "unresolved" }),
    row("2", { unmeasuredReason: "unresolved" }),
    row("3", { unmeasuredReason: "ambiguous", ambiguousDbnames: ["A", "B"] }),
    row("4", { dbname: "A", unmeasuredReason: "no_schedule", samsUserActive: false }),
    row("5", { dbname: "B", samsUserActive: false }),
    row("9", { dbname: "B", unmeasuredReason: "no_schedule" }),
  ]));
  Resident.find.mockReturnValue(chain(["1", "2", "3", "4", "5"].map(person)));
  SamsPresence.aggregate.mockResolvedValue([{ _id: "1", dbname: "A" }]);
}

describe("collectWarnings — so'rov va guruhlash", () => {
  beforeEach(seedFlagged);

  it("so'rov: dbname $in + null chegarasi, kun, sabablar YOKI samsUserActive:false", async () => {
    await W.collectWarnings(DAY, { titles: TITLES });
    expect(SamsPresence.find).toHaveBeenCalledWith({
      dbname: { $in: ["A", "B", null] },
      day: DAY,
      $or: [{ unmeasuredReason: { $in: ["unresolved", "ambiguous", "no_schedule"] } }, { samsUserActive: false }],
    });
    const [{ $match }] = SamsPresence.aggregate.mock.calls[0][0];
    expect($match).toEqual({ resident: { $in: ["1", "2"] }, dbname: { $ne: null }, day: { $gte: "2026-06-27", $lt: DAY } });
  });

  it("hal qilinmaganlar oxirgi ma'lum klinika bo'yicha; topilmasa — null (noma'lum) guruhi", async () => {
    const w = await W.collectWarnings(DAY, { titles: TITLES });
    expect(w.unresolved.count).toBe(2);
    expect(w.unresolved.groups).toEqual([
      { dbname: "A", orgTitle: "Klinika A", residents: [expect.objectContaining({ resident: "1", jshshir: "30101990000001" })] },
      { dbname: null, orgTitle: null, residents: [expect.objectContaining({ resident: "2", fullName: "Ism 2" })] },
    ]);
  });

  it("ambiguous — klinikalari bilan; bitta qator ikki tur (no_schedule + nofaol); o'chirilgan tushadi", async () => {
    const w = await W.collectWarnings(DAY, { titles: TITLES });
    expect(w.ambiguous.items).toEqual([expect.objectContaining({ resident: "3", clinics: [{ dbname: "A", orgTitle: "Klinika A" }, { dbname: "B", orgTitle: "Klinika B" }] })]);
    expect(w.noSchedule).toEqual({ count: 1, groups: [{ dbname: "A", orgTitle: "Klinika A", residents: [expect.objectContaining({ resident: "4" })] }] });
    expect(w.inactiveUser.count).toBe(2);
    expect(w.inactiveUser.groups.map((g) => g.dbname).sort()).toEqual(["A", "B"]);
  });

});

describe("collectWarnings — kalitlar va bo'sh holat", () => {
  beforeEach(seedFlagged);

  it("kalitlar `<tur>:<id>`; isNew — oldingi yig'mada yo'q; newKeys — faqat yangilari", async () => {
    const w = await W.collectWarnings(DAY, { titles: TITLES, prevKeys: new Set(["unresolved:1", "inactive_user:5"]) });
    expect(w.keys).toEqual(["unresolved:1", "unresolved:2", "ambiguous:3", "no_schedule:4", "inactive_user:4", "inactive_user:5"]);
    expect(w.unresolved.groups[0].residents[0].isNew).toBe(false);
    expect(w.unresolved.groups[1].residents[0].isNew).toBe(true);
    expect(W.newKeys(w.keys, new Set(["unresolved:1", "inactive_user:5"]))).toEqual([
      "unresolved:2", "ambiguous:3", "no_schedule:4", "inactive_user:4",
    ]);
  });

  it("kun yo'q yoki qator yo'q — bo'sh shakl, rezident so'rovi yo'q", async () => {
    const empty = { unresolved: { count: 0, groups: [] }, ambiguous: { count: 0, items: [] }, noSchedule: { count: 0, groups: [] }, inactiveUser: { count: 0, groups: [] }, keys: [] };
    await expect(W.collectWarnings(null, { titles: TITLES })).resolves.toEqual(empty);
    SamsPresence.find.mockReturnValueOnce(chain([]));
    await expect(W.collectWarnings(DAY, { titles: TITLES })).resolves.toEqual(empty);
    expect(Resident.find).not.toHaveBeenCalled();
  });
});
