"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const { buildHeaderSpans } = require("./headerSpans");

describe("buildHeaderSpans — sof funksiya, sintetik fixture", () => {
  const FIXTURE = [
    { key: "a", w: 10, grp1: "g1", grp2: "x" },
    { key: "b", w: 10, grp1: "g1", grp2: "x" },
    { key: "c", w: 10, grp1: "g1", grp2: "y" },
    { key: "d", w: 10, grp1: "g2" },
    { key: "e", w: 10, grp1: "g2" },
  ];

  test("ketma-ket bir xil qiymatlarni bitta span qilib yig'adi", () => {
    expect(buildHeaderSpans(FIXTURE)).toEqual({
      grp1: [
        { value: "g1", from: 0, to: 3 },
        { value: "g2", from: 3, to: 5 },
      ],
      grp2: [
        { value: "x", from: 0, to: 2 },
        { value: "y", from: 2, to: 3 },
      ],
    });
  });

  test("ustun qo'shilsa avvalgi qattiq kutuv endi noto'g'ri chiqadi (mexanizm isboti)", () => {
    const withExtraCol = [
      FIXTURE[0],
      { key: "new", w: 5, grp1: "g1", grp2: "x" },
      ...FIXTURE.slice(1),
    ];
    const before = buildHeaderSpans(FIXTURE).grp1.find((s) => s.value === "g1");
    const after = buildHeaderSpans(withExtraCol).grp1.find((s) => s.value === "g1");
    expect(after.to - after.from).toBe(before.to - before.from + 1);
    expect(after).not.toEqual(before);
  });

  test("grp1/grp2 bo'lmagan ustun (undefined) hech qanday span'ga kirmaydi", () => {
    const withInfoCols = [{ key: "info", w: 20 }, ...FIXTURE];
    const spans = buildHeaderSpans(withInfoCols);
    const covered = new Set();
    for (const s of [...spans.grp1, ...spans.grp2]) {
      for (let i = s.from; i < s.to; i++) covered.add(i);
    }
    expect(covered.has(0)).toBe(false);
  });

  test("bo'sh massiv — bo'sh span ro'yxati, yiqilmaydi", () => {
    expect(buildHeaderSpans([])).toEqual({ grp1: [], grp2: [] });
  });
});

describe("konsolidatsiya — workload.pdf.js re-export shu funksiyaning O'ZI", () => {
  test("workload.pdf.js dan re-export qilingan buildHeaderSpans aynan shu modul funksiyasi (===)", () => {
    const workloadPdf = require("../_pdf/workload.pdf");
    expect(workloadPdf.buildHeaderSpans).toBe(buildHeaderSpans);
  });

  test("workload.pdf.js ning haqiqiy COLS'i bilan chaqirilganda ikki chaqiruv bir xil natija beradi", () => {
    const workloadPdf = require("../_pdf/workload.pdf");
    const viaWorkload = workloadPdf.buildHeaderSpans(workloadPdf.COLS);
    const viaShared = buildHeaderSpans(workloadPdf.COLS);
    expect(viaWorkload).toEqual(viaShared);
    expect(viaShared.grp1).toEqual([
      { value: "oQuv", from: 6, to: 22 },
      { value: "boshqa", from: 22, to: 29 },
      { value: "jami", from: 29, to: 30 },
    ]);
  });
});
