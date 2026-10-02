const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf, COLS } = require("./workload.pdf");

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wlFixture = () => ({
  _id: new mongoose.Types.ObjectId(),
  department: { title: "Stomatologiya va otorinolaringologiya kafedrasi" },
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  directions: [],
  approvalSteps: [],
  agreed: {},
  confirmation: {},
  methodicalHead: null,
  financialHead: null,
  staffPositions: null,
});

const render = async (wl) => {
  WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(wl));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    return spy.mock.calls;
  } finally {
    spy.mockRestore();
  }
};

describe("workload.pdf — sarlavha matni kesilmaydi", () => {
  test("hech bir doc.text chaqiruvi `ellipsis` bilan kelmaydi", async () => {
    const calls = await render(wlFixture());
    expect(calls.filter((c) => c[3] && c[3].ellipsis)).toEqual([]);
  });

  test("eng uzun aylantirilgan sarlavha to'liq matn bilan, lineBreak:true", async () => {
    const calls = await render(wlFixture());
    const longest = COLS.map((c) => c.hdr).sort((a, b) => b.length - a.length)[0];
    const call = calls.find((c) => c[0] === longest);
    expect(call).toBeDefined();
    expect(call[3].lineBreak).toBe(true);
  });
});
