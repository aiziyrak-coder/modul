const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);

const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { buildDistributionPdf } = require("./distribution.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const distFixture = () => ({
  title: null,
  confirmation: {},
  department: { title: "Gigiyena va ekologiya kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2026/2027" },
  status: "approved",
  teachers: [],
  staffPositions: { items: [], totalPositions: 36, hourly: 0 },
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
});

beforeEach(() => jest.clearAllMocks());

describe("distribution PDF — footer bo'sh bet ochmaydi", () => {
  test("1 betlik taqsimot: footer'dan keyin bet soni O'ZGARMAYDI (3 emas, 1)", async () => {
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(distFixture()));
    const addPageSpy = jest.spyOn(PDFDocument.prototype, "addPage");
    try {
      const doc = await buildDistributionPdf("dist1");
      doc.end();
      expect(addPageSpy).toHaveBeenCalledTimes(1);
    } finally {
      addPageSpy.mockRestore();
    }
  });

  test("footer matni har betda bittadan: 'N / N' va status qatori", async () => {
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(distFixture()));
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    try {
      const doc = await buildDistributionPdf("dist2");
      doc.end();
      const texts = spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
      expect(texts.filter((t) => /^\d+ \/ \d+$/.test(t))).toEqual(["1 / 1"]);
      expect(texts.filter((t) => t.startsWith("Yuklama taqsimoti |"))).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
