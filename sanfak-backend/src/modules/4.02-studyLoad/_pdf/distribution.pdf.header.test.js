"use strict";

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);

const {
  COLS,
  GRP1_LABELS,
  GRP2_LABELS,
} = require("./distribution.pdf");
const { buildHeaderSpans } = require("#modules/4.02-studyLoad/_shared/headerSpans");

describe("buildHeaderSpans(COLS) — distribution, blanka bilan tasdiqlangan (R-4.02-27)", () => {
  const spans = buildHeaderSpans(COLS);

  test("grp1 — 'oQuv' {7,20}", () => {
    expect(spans.grp1.filter((s) => s.value !== "jami")).toEqual([
      { value: "oQuv", from: 7, to: 20 },
    ]);
  });

  test("grp2 — 4 guruh, blanka koordinatalari bilan mos", () => {
    expect(spans.grp2).toEqual([
      { value: "mazkur", from: 7, to: 9 },
      { value: "maruza", from: 9, to: 11 },
      { value: "klinik", from: 11, to: 13 },
      { value: "lab", from: 13, to: 16 },
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
        (s, span) => s + COLS.slice(span.from, span.to).reduce((ss, c) => ss + c.w, 0),
        0,
      );
    const sumColWidths = (key) => COLS.filter((c) => c[key]).reduce((s, c) => s + c.w, 0);

    expect(sumSpanWidths(spans.grp1)).toBe(sumColWidths("grp1"));
    expect(sumSpanWidths(spans.grp2)).toBe(sumColWidths("grp2"));
  });

  test("(c) yorliqsiz bo'sh band yo'q — har span uchun GRP1_LABELS/GRP2_LABELS da matn bor", () => {
    for (const s of spans.grp1) {
      if (s.value === "jami") continue;
      expect(GRP1_LABELS[s.value]).toBeTruthy();
      expect(GRP1_LABELS[s.value].text.length).toBeGreaterThan(0);
    }
    for (const s of spans.grp2) {
      expect(GRP2_LABELS[s.value]).toEqual(expect.any(String));
      expect(GRP2_LABELS[s.value].length).toBeGreaterThan(0);
    }
  });

  test("(d) COLS ga ustun qo'shilsa — span chegarasi mexanik siljiydi (qattiq indeks yo'q)", () => {
    const withExtraCol = [
      ...COLS.slice(0, 9),
      { key: "new", w: 5, grp1: "oQuv", grp2: "maruza" },
      ...COLS.slice(9),
    ];
    const before = spans.grp2.find((s) => s.value === "maruza");
    const after = buildHeaderSpans(withExtraCol).grp2.find((s) => s.value === "maruza");
    expect(after.to - after.from).toBe(before.to - before.from + 1);
  });
});

describe("drawTableHeader (integratsiya) — barcha grp2 yorlig'i chiziladi", () => {
  const mongoose = require("mongoose");
  const PDFDocument = require("pdfkit");
  const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
  const { buildDistributionPdf } = require("./distribution.pdf");

  const chainablePopulate = (doc) => {
    const chain = {};
    chain.populate = jest.fn().mockReturnValue(chain);
    chain.exec = jest.fn().mockResolvedValue(doc);
    return chain;
  };

  const distFixture = () => ({
    title: null,
    confirmation: {},
    department: { title: "Stomatologiya kafedrasi" },
    date: null,
    academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
    status: "draft",
    teachers: [],
    staffPositions: null,
    methodicalHead: null,
    financialHead: null,
    departmentHead: null,
    approvalSteps: [],
  });

  beforeEach(() => jest.clearAllMocks());

  test("barcha 4 grp2 yorlig'i hujjatda chiziladi", async () => {
    WorkloadDistribution.findById = jest.fn().mockReturnValue(chainablePopulate(distFixture()));
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildDistributionPdf("dist1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]);
    spy.mockRestore();

    for (const label of Object.values(GRP2_LABELS)) {
      expect(texts).toContain(label);
    }
  });
});
