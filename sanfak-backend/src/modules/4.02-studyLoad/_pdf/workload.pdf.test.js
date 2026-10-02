const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf } = require("./workload.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const baseFixture = (academicYear) => ({
  title: null,
  agreed: {},
  confirmation: {},
  department: { title: "Ichki kasalliklar kafedrasi" },
  date: null,
  academicYear,
  status: "draft",
  directions: [],
  staffPositions: null,
  methodicalHead: null,
  financialHead: null,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildWorkloadPdf (workload.pdf.js) — academicYear ObjectId ref (D-094 regressiya)", () => {
  test("populate qilingan { title } bo'lsa — PDF xatosiz quriladi", async () => {
    WorkloadModel.findById = jest
      .fn()
      .mockReturnValue(
        chainablePopulate(
          baseFixture({ _id: new mongoose.Types.ObjectId(), title: "2025/2026" }),
        ),
      );

    const doc = await buildWorkloadPdf("wlId1");
    expect(() => doc.end()).not.toThrow();
  });

  test("populate qilinmagan xom ObjectId bo'lsa — xato otilmaydi va PDF matnida hex chiqmaydi", async () => {
    const rawId = new mongoose.Types.ObjectId();
    WorkloadModel.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(baseFixture(rawId)));

    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildWorkloadPdf("wlId2");
    doc.end();

    const leaked = textSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes(rawId.toString()),
    );
    expect(leaked).toBe(false);
    textSpy.mockRestore();
  });

  test("academicYear null bo'lsa ham xatosiz quriladi", async () => {
    WorkloadModel.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(baseFixture(null)));

    await expect(buildWorkloadPdf("wlId3")).resolves.toBeDefined();
  });

  test("query zanjiriga `academicYear` populate qo'shilgan", async () => {
    const chain = chainablePopulate(baseFixture(null));
    WorkloadModel.findById = jest.fn().mockReturnValue(chain);

    await buildWorkloadPdf("wlId4");

    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
  });
});
