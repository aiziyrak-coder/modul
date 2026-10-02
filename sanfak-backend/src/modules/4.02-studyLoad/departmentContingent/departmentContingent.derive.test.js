"use strict";

const {
  rowGroupIds,
  duplicateGroupIds,
  sameIdSet,
  applyStreamPartition,
  findRow,
  groupProblem,
  rowProblems,
  streamLanguages,
  rowDerived,
  suggestStreams,
} = require("./departmentContingent.derive");

const BASE = { studentCount: 120, groupCount: 6, streamCount: 1 };
const row = (streams, over = {}) => ({ direction: "d1", course: "c2", courseNum: 2, streams, ...over });

describe("applyStreamPartition — K2 (faqat streamCount almashadi)", () => {
  test("qator yo'q — natija o'zgarmaydi, source=none", () => {
    expect(applyStreamPartition(BASE, null, ["g1"])).toEqual({ ...BASE, contingent: { source: "none" } });
  });

  test("qator aktiv guruhlarni AYNAN qoplaydi — faqat oqimlar soni almashadi", () => {
    const r = row([{ number: 1, groups: ["g1", "g2", "g3"] }, { number: 2, groups: ["g4", "g5", "g6"] }]);
    const out = applyStreamPartition(BASE, r, ["g6", "g5", "g4", "g3", "g2", "g1"]);
    expect(out).toEqual({ studentCount: 120, groupCount: 6, streamCount: 2, contingent: { source: "contingent" } });
  });

  test("jadvalga yangi guruh qo'shilgan (qator qoplamaydi) — eskirgan, hozirgi qoida", () => {
    const r = row([{ number: 1, groups: ["g1", "g2"] }, { number: 2, groups: ["g3"] }]);
    const out = applyStreamPartition(BASE, r, ["g1", "g2", "g3", "g4"]);
    expect(out.streamCount).toBe(1);
    expect(out.contingent.source).toBe("stale");
  });

  test("qatorda o'chirilgan guruh qolgan — eskirgan", () => {
    const r = row([{ number: 1, groups: ["g1", "gX"] }]);
    expect(applyStreamPartition(BASE, r, ["g1"]).contingent.source).toBe("stale");
  });

  test("bo'sh oqimlar hisobga olinmaydi; hammasi bo'sh — eskirgan", () => {
    const r = row([{ number: 1, groups: ["g1"] }, { number: 2, groups: [] }]);
    expect(applyStreamPartition(BASE, r, ["g1"]).streamCount).toBe(1);
    expect(applyStreamPartition(BASE, row([{ number: 1, groups: [] }]), []).contingent.source).toBe("stale");
  });
});

describe("guruh to'plamlari", () => {
  test("rowGroupIds — takrorlarsiz, ObjectId/obyekt/string aralash", () => {
    const r = row([{ number: 1, groups: ["g1", { _id: "g2" }] }, { number: 2, groups: ["g1"] }]);
    expect(rowGroupIds(r).sort()).toEqual(["g1", "g2"]);
  });

  test("duplicateGroupIds — bir necha oqimdagi guruh", () => {
    const r = row([{ number: 1, groups: ["g1", "g2"] }, { number: 2, groups: ["g2", "g3"] }]);
    expect(duplicateGroupIds(r)).toEqual(["g2"]);
  });

  test("sameIdSet — tartib ahamiyatsiz, o'lcham farqi = teng emas", () => {
    expect(sameIdSet(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameIdSet(["a"], ["a", "b"])).toBe(false);
  });

  test("findRow — yo'nalish + kurs ObjectId bo'yicha", () => {
    const doc = { rows: [row([], { course: "c1" }), row([], { course: "c2" })] };
    expect(findRow(doc, "d1", "c2").course).toBe("c2");
    expect(findRow(doc, "d9", "c2")).toBeNull();
    expect(findRow(null, "d1", "c2")).toBeNull();
  });
});

describe("invariantlar (K2) — groupProblem / rowProblems", () => {
  const ok = { _id: "g1", title: "101", direction: "d1", course: "c2", academicYear: "y1", active: true };
  const map = (...groups) => new Map(groups.map((g) => [g._id, g]));

  test.each([
    [{ ...ok, active: false }, "faol emas"],
    [{ ...ok, academicYear: null }, "o'quv yiliga biriktirilmagan"],
    [{ ...ok, academicYear: "y2" }, "boshqa o'quv yiliga"],
    [{ ...ok, direction: "d2" }, "boshqa yo'nalishga"],
    [{ ...ok, course: "c3" }, "boshqa kursga"],
  ])("%o → «%s»", (group, text) => {
    expect(groupProblem(group, row([]), "y1")).toContain(text);
  });

  test("mos guruh — muammo yo'q; topilmagan guruh — muammo", () => {
    expect(groupProblem(ok, row([]), "y1")).toBeNull();
    expect(groupProblem(undefined, row([]), "y1")).toBe("guruh topilmadi");
  });

  test("rowProblems — bo'sh qator va takroriy guruh", () => {
    expect(rowProblems(row([]), map(ok), "y1")).toContain("kamida bitta oqim guruhlari bilan kerak");
    const dup = row([{ number: 1, groups: ["g1"] }, { number: 2, groups: ["g1"] }]);
    expect(rowProblems(dup, map(ok), "y1")).toContain("bitta guruh bir necha oqimda turibdi");
    expect(rowProblems(row([{ number: 1, groups: ["g1"] }]), map(ok), "y1")).toEqual([]);
  });
});

describe("hosila qiymatlar va taklif", () => {
  const groups = new Map([
    ["g1", { _id: "g1", lang: "uz", studentNumber: 20 }],
    ["g2", { _id: "g2", lang: "uz", studentNumber: 22 }],
    ["g3", { _id: "g3", lang: "ru", studentNumber: 18 }],
  ]);

  test("rowDerived — guruh/talaba/oqim (saqlanmaydi, groups dan)", () => {
    const r = row([{ number: 1, groups: ["g1", "g2"] }, { number: 2, groups: ["g3"] }]);
    expect(rowDerived(r, groups)).toEqual({ groupCount: 3, studentCount: 60, streamCount: 2 });
  });

  test("streamLanguages — til guruhlardan hosila, aralash oqim ruxsat", () => {
    expect(streamLanguages({ groups: ["g1", "g3"] }, groups).sort()).toEqual(["ru", "uz"]);
  });

  test("suggestStreams — har til bitta oqim (hozirgi qoida bilan bir xil)", () => {
    const out = suggestStreams([...groups.values()]);
    expect(out).toEqual([
      { number: 1, groups: ["g1", "g2"] },
      { number: 2, groups: ["g3"] },
    ]);
  });
});
