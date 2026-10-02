"use strict";

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf } = require("./workload.pdf");

const PG_M = 18;
const CW = 842 - PG_M * 2;
const LBL_W = 90;
const REST_W = CW - LBL_W;
const H1 = 14;
const H2 = 16;
const RIGHT_EDGE = PG_M + CW;

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wlFixture = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  department: { title: "Stomatologiya kafedrasi" },
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  directions: [],
  approvalSteps: [],
  agreed: {},
  confirmation: {},
  methodicalHead: null,
  financialHead: null,
  staffPositions: { items: [], totalPositions: 0, hourly: 0 },
  status: "draft",
  verify: null,
  ...overrides,
});

const renderRects = async () => {
  WorkloadModel.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(wlFixture()));
  const spy = jest.spyOn(PDFDocument.prototype, "rect");
  try {
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    return spy.mock.calls.map(([x, y, w, h]) => ({ x, y, w, h }));
  } finally {
    spy.mockRestore();
  }
};

describe("kadrlar jadvali — guruh sarlavhalari leaf qatori bilan bir xil kenglikda", () => {
  let rects;
  let staffY;

  beforeAll(async () => {
    rects = await renderRects();
    const anchor = rects.find(
      (r) => r.x === PG_M && r.w === LBL_W && r.h === H1 + H2,
    );
    expect(anchor).toBeDefined();
    staffY = anchor.y;
  });

  test("guruh sarlavhalari (3 ta) yig'indisi REST_W ga teng va o'ng chegara 824", () => {
    const groups = rects
      .filter((r) => r.y === staffY && r.h === H1 && r.x >= PG_M + LBL_W)
      .sort((a, b) => a.x - b.x);

    expect(groups).toHaveLength(3);
    expect(groups[0].x).toBe(PG_M + LBL_W);

    const sum = groups.reduce((s, r) => s + r.w, 0);
    expect(sum).toBe(REST_W);

    const last = groups[groups.length - 1];
    expect(last.x + last.w).toBe(RIGHT_EDGE);
  });

  test("leaf ustunlari (13 ta) yig'indisi ham REST_W — guruh qatori bilan AYNAN mos", () => {
    const leafs = rects
      .filter((r) => r.y === staffY + H1 && r.h === H2 && r.x >= PG_M + LBL_W)
      .sort((a, b) => a.x - b.x);

    expect(leafs).toHaveLength(13);
    const sum = leafs.reduce((s, r) => s + r.w, 0);
    expect(sum).toBe(REST_W);

    const last = leafs[leafs.length - 1];
    expect(last.x + last.w).toBe(RIGHT_EDGE);
  });

  test("har guruh chegarasi leaf ustun chegarasiga tushadi (x koordinatalari mos)", () => {
    const groups = rects
      .filter((r) => r.y === staffY && r.h === H1 && r.x >= PG_M + LBL_W)
      .sort((a, b) => a.x - b.x);
    const leafXs = rects
      .filter((r) => r.y === staffY + H1 && r.h === H2 && r.x >= PG_M + LBL_W)
      .map((r) => r.x)
      .sort((a, b) => a - b);

    expect(groups.map((g) => g.x)).toEqual([leafXs[0], leafXs[3], leafXs[9]]);
  });
});
