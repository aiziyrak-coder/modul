"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const {
  buildHeaderSpans,
  COLS,
  GRP1_LABELS,
  GRP2_LABELS,
} = require("./workload.pdf");

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

  test("(d) — ustun qo'shilsa avvalgi qattiq kutuv endi noto'g'ri chiqadi (mexanizm isboti)", () => {
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
    const withInfoCols = [
      { key: "info", w: 20 },
      ...FIXTURE,
    ];
    const spans = buildHeaderSpans(withInfoCols);
    const covered = new Set();
    for (const s of [...spans.grp1, ...spans.grp2]) {
      for (let i = s.from; i < s.to; i++) covered.add(i);
    }
    expect(covered.has(0)).toBe(false);
  });
});

describe("buildHeaderSpans(COLS) — REAL sarlavha, blanka bilan tasdiqlangan (R-4.02-27)", () => {
  const spans = buildHeaderSpans(COLS);

  test("grp1 — 'oQuv' {6,22}, 'boshqa' {22,29}, 'jami' {29,30}", () => {
    expect(spans.grp1).toEqual([
      { value: "oQuv", from: 6, to: 22 },
      { value: "boshqa", from: 22, to: 29 },
      { value: "jami", from: 29, to: 30 },
    ]);
  });

  test("grp2 — 7 guruh, to'g'ri chegaralarda (seminar YANGI qo'shilgan)", () => {
    expect(spans.grp2).toEqual([
      { value: "mazkur", from: 6, to: 8 },
      { value: "maruza", from: 8, to: 10 },
      { value: "klinik", from: 10, to: 12 },
      { value: "seminar", from: 12, to: 14 },
      { value: "lab", from: 14, to: 16 },
      { value: "amaliy", from: 16, to: 18 },
      { value: "ochiq", from: 26, to: 28 },
    ]);
  });

  test("(a) grp1/grp2 bo'lgan HAR ustun aynan bitta span'ga tegishli", () => {
    const checkExclusive = (key, spanList) => {
      const withValue = COLS.map((c, i) => ({ i, v: c[key] })).filter((c) => c.v);
      for (const { i, v } of withValue) {
        const owners = spanList.filter((s) => i >= s.from && i < s.to);
        expect(owners).toHaveLength(1);
        expect(owners[0].value).toBe(v);
      }
    };
    checkExclusive("grp1", spans.grp1);
    checkExclusive("grp2", spans.grp2);
  });

  test("(b) span kengliklari yig'indisi = qamragan ustun kengliklari yig'indisi", () => {
    const sumSpanWidths = (spanList) =>
      spanList.reduce(
        (s, span) =>
          s +
          COLS.slice(span.from, span.to).reduce((ss, c) => ss + c.w, 0),
        0,
      );
    const sumColWidths = (key) =>
      COLS.filter((c) => c[key]).reduce((s, c) => s + c.w, 0);

    expect(sumSpanWidths(spans.grp1)).toBe(sumColWidths("grp1"));
    expect(sumSpanWidths(spans.grp2)).toBe(sumColWidths("grp2"));
  });

  test("(c) yorliqsiz bo'sh band yo'q — har span uchun GRP1_LABELS/GRP2_LABELS da matn bor", () => {
    for (const s of spans.grp1) {
      if (s.value === "jami") continue;
      expect(GRP1_LABELS[s.value]).toBeTruthy();
      expect(GRP1_LABELS[s.value].text).toEqual(expect.any(String));
      expect(GRP1_LABELS[s.value].text.length).toBeGreaterThan(0);
    }
    for (const s of spans.grp2) {
      expect(GRP2_LABELS[s.value]).toEqual(expect.any(String));
      expect(GRP2_LABELS[s.value].length).toBeGreaterThan(0);
    }
  });
});

describe("drawMainTableHeader (integratsiya) — chizilgan sarlavhada bo'sh band yo'q", () => {
  const mongoose = require("mongoose");
  const PDFDocument = require("pdfkit");
  const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
  const { buildWorkloadPdf } = require("./workload.pdf");

  const chainablePopulate = (doc) => {
    const chain = {};
    chain.populate = jest.fn().mockReturnValue(chain);
    chain.exec = jest.fn().mockResolvedValue(doc);
    return chain;
  };

  const wlFixture = () => ({
    _id: new mongoose.Types.ObjectId(),
    department: { title: "Stomatologiya kafedrasi" },
    academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
    directions: [],
    approvalSteps: [],
    agreed: {},
    confirmation: {},
    methodicalHead: null,
    financialHead: null,
    staffPositions: null,
  });

  beforeEach(() => jest.clearAllMocks());

  test("barcha 7 grp2 yorlig'i (Seminar HAM) hujjatda chiziladi", async () => {
    WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(wlFixture()));
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]);
    spy.mockRestore();

    for (const label of Object.values(GRP2_LABELS)) {
      expect(texts).toContain(label);
    }
  });

  test("imzo bloklarida moveTo/lineTo YO'Q — faqat footer chizig'i qoladi (1 sahifa)", async () => {
    const approved = (step, name) => ({
      step,
      status: "approved",
      approvedBy: { lastName: name[0], firstName: name[1] },
      date: new Date(2026, 8, 3),
    });
    const wl = {
      ...wlFixture(),
      approvalSteps: [
        approved("methodical", ["Nodirov", "A."]),
        approved("financial", ["Yusupova", "N."]),
        approved("prorektor", ["Boltaboyev", "U."]),
        approved("rektor", ["Karimov", "R."]),
      ],
    };
    WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(wl));
    const moveSpy = jest.spyOn(PDFDocument.prototype, "moveTo");
    const lineSpy = jest.spyOn(PDFDocument.prototype, "lineTo");
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    const moveCalls = moveSpy.mock.calls.length;
    const lineCalls = lineSpy.mock.calls.length;
    moveSpy.mockRestore();
    lineSpy.mockRestore();

    expect(moveCalls).toBe(1);
    expect(lineCalls).toBe(1);
  });
});
