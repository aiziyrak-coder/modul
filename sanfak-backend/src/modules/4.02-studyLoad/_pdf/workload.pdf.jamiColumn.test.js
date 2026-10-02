const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf } = require("./workload.pdf");

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wlFixture = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  department: { title: "Ichki kasalliklar kafedrasi" },
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2026/2027" },
  directions: [],
  approvalSteps: [],
  agreed: {},
  confirmation: {},
  methodicalHead: null,
  financialHead: null,
  staffPositions: null,
  ...overrides,
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawTableHeader — oxirgi 'Jami soat' ustuni", () => {
  test("'Jami soat' sarlavhasi FAQAT BIR MARTA chiziladi (ustma-ust tushmaydi)", async () => {
    const calls = await render(wlFixture());
    const jami = calls.filter((c) => c[0] === "Jami soat");
    expect(jami).toHaveLength(1);
  });

  test("qolgan aylantirilgan sarlavhalar chizilishda davom etadi", async () => {
    const calls = await render(wlFixture());
    const texts = calls.map((c) => c[0]);
    expect(texts).toContain("Umumiy soat");
    expect(texts).toContain("KO rahbarlik qilish (1 KO uchun 100 soat)");
  });
});
