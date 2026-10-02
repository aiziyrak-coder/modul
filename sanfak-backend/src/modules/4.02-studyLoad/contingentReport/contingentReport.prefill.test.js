"use strict";

jest.mock("#references/direction/direction.model", () => ({ find: jest.fn() }));
jest.mock("#references/group/group.model", () => ({ find: jest.fn() }));
jest.mock("#references/course/course.model", () => ({ find: jest.fn() }));

const {
  courseNumberFromTitle,
  aggregateGroups,
  mergePrefill,
  PREFILL_CELLS,
} = require("./contingentReport.prefill");

describe("courseNumberFromTitle — `course` ma'lumotnomasi sarlavhasi → raqam", () => {
  test.each([
    ["1-kurs", 1],
    ["6-kurs", 6],
    ["I", 1],
    ["III kurs", 3],
    ["2", 2],
    ["7-kurs", null],
    ["", null],
    [null, null],
    ["kurs", null],
  ])("%s → %s", (title, expected) => {
    expect(courseNumberFromTitle(title)).toBe(expected);
  });
});

describe("aggregateGroups — yo'nalish × kurs statistikasi (S5: har til = 1 oqim)", () => {
  const courseNumbers = new Map([
    ["c1", 1],
    ["c2", 2],
  ]);
  const groups = [
    { direction: "d1", course: "c1", lang: "uz", studentNumber: 22, academicYear: "ay" },
    { direction: "d1", course: "c1", lang: "uz", studentNumber: 21, academicYear: "ay" },
    { direction: "d1", course: "c1", lang: "ru", studentNumber: 18, academicYear: "ay" },
    { direction: "d1", course: "c2", lang: "uz", studentNumber: 25, academicYear: "ay" },
    { direction: "d1", course: "c2", lang: "ru", studentNumber: 20, academicYear: "ay" },
    { direction: "d1", course: "c1", lang: "uz", studentNumber: 99, academicYear: null },
    { direction: "d1", course: "c9", lang: "uz", studentNumber: 5, academicYear: "ay" },
    { direction: "d2", course: "c1", lang: null, studentNumber: 10, academicYear: "ay" },
  ];

  test("Davolash 2026/2027 o'lchovi: 1-kurs 61/3/2, 2-kurs 45/2/2", () => {
    const { stats, groupsWithoutYear, unresolvedCourse } = aggregateGroups(groups, courseNumbers);
    expect(stats.get("d1|1")).toEqual({ total: 61, groupCount: 3, streamCount: 2 });
    expect(stats.get("d1|2")).toEqual({ total: 45, groupCount: 2, streamCount: 2 });
    expect(stats.get("d2|1")).toEqual({ total: 10, groupCount: 1, streamCount: 0 });
    expect(groupsWithoutYear).toBe(1);
    expect(unresolvedCourse).toBe(1);
  });

  test("bo'sh ro'yxat — bo'sh Map", () => {
    expect(aggregateGroups([], courseNumbers).stats.size).toBe(0);
  });
});

const directions = [
  { _id: "d1", title: "Davolash ishi", directionCode: "60910200", international: false },
  { _id: "d2", title: "Pediatriya ishi", directionCode: "", international: true },
];
const fresh = (over) => ({
  direction: "d1",
  directionCode: "60910200",
  directionTitle: "Davolash ishi",
  category: "milliy",
  course: 1,
  total: 61,
  groupCount: 3,
  streamCount: 2,
  source: { total: "groups", groupCount: "groups", streamCount: "groups" },
  ...over,
});

describe("mergePrefill — idempotent, manual tegilmaydi, yangi qator qo'shiladi", () => {
  test("groups-manba katak yangilanadi, manual katak SAQLANADI (force yo'q)", () => {
    const doc = {
      rows: [
        {
          direction: "d1",
          course: 1,
          category: "milliy",
          total: 50,
          groupCount: 3,
          streamCount: 5,
          boys: 20,
          source: { total: "groups", groupCount: "groups", streamCount: "manual" },
        },
      ],
    };
    const res = mergePrefill(doc, { rows: [fresh()], directions });
    expect(res).toEqual({ updated: 1, added: 0, skippedManual: 1 });
    expect(doc.rows[0]).toMatchObject({ total: 61, groupCount: 3, streamCount: 5, boys: 20 });
    expect(doc.rows[0].source).toEqual({ total: "groups", groupCount: "groups", streamCount: "manual" });
    expect(doc.rows[0].directionCode).toBe("60910200");
  });

  test("force — manual katak ham qayta yoziladi va manbasi groups'ga qaytadi", () => {
    const doc = {
      rows: [{ direction: "d1", course: 1, category: "milliy", total: 50, groupCount: 3, streamCount: 5, source: { total: "manual", groupCount: "manual", streamCount: "manual" } }],
    };
    const res = mergePrefill(doc, { rows: [fresh()], directions }, { force: true });
    expect(res.skippedManual).toBe(0);
    expect(doc.rows[0]).toMatchObject({ total: 61, groupCount: 3, streamCount: 2 });
    expect(doc.rows[0].source).toEqual({ total: "groups", groupCount: "groups", streamCount: "groups" });
  });
});

describe("mergePrefill — idempotentlik va qator qo'shish", () => {
  test("ikkinchi yurgizish — 0 o'zgarish (idempotent)", () => {
    const doc = { rows: [] };
    expect(mergePrefill(doc, { rows: [fresh()], directions })).toEqual({ updated: 0, added: 1, skippedManual: 0 });
    expect(mergePrefill(doc, { rows: [fresh()], directions })).toEqual({ updated: 0, added: 0, skippedManual: 0 });
    expect(doc.rows).toHaveLength(1);
  });

  test("mavjud qatorlar O'CHIRILMAYDI — prefill'da yo'q qator qoladi", () => {
    const doc = {
      rows: [{ direction: "d1", course: 6, category: "milliy", total: 7, groupCount: 1, streamCount: 1, source: { total: "manual", groupCount: "manual", streamCount: "manual" } }],
    };
    mergePrefill(doc, { rows: [fresh()], directions });
    expect(doc.rows).toHaveLength(2);
    expect(doc.rows[0].course).toBe(6);
  });
});

describe("mergePrefill — toifa bo'yicha biriktirish", () => {
  test("statistika yo'nalishning STANDART toifasidagi qatorga biriktiriladi (mdh qatori tegilmaydi)", () => {
    const doc = {
      rows: [
        { direction: "d1", course: 1, category: "mdh", total: 37, groupCount: 1, streamCount: 1, source: { total: "manual", groupCount: "manual", streamCount: "manual" } },
        { direction: "d1", course: 1, category: "milliy", total: 0, groupCount: 0, streamCount: 0, source: { total: "groups", groupCount: "groups", streamCount: "groups" } },
      ],
    };
    mergePrefill(doc, { rows: [fresh()], directions });
    expect(doc.rows[0]).toMatchObject({ category: "mdh", total: 37 });
    expect(doc.rows[1]).toMatchObject({ category: "milliy", total: 61, groupCount: 3, streamCount: 2 });
  });

  test("standart toifa qatori yo'q bo'lsa — birinchi mos qatorga (xorijiy yo'nalish → xorijiy)", () => {
    const doc = {
      rows: [{ direction: "d2", course: 1, category: "xorijiy_gibrid", total: 0, groupCount: 0, streamCount: 0, source: { total: "groups", groupCount: "groups", streamCount: "groups" } }],
    };
    const freshD2 = fresh({ direction: "d2", directionCode: "", directionTitle: "Pediatriya ishi", category: "xorijiy", total: 20, groupCount: 1, streamCount: 1 });
    mergePrefill(doc, { rows: [freshD2], directions });
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]).toMatchObject({ category: "xorijiy_gibrid", total: 20 });
  });

  test("PREFILL_CELLS — aynan 3 katak", () => {
    expect(PREFILL_CELLS).toEqual(["total", "groupCount", "streamCount"]);
  });
});
