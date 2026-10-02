const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const {
  buildWorkloadPdf,
  FOOTER_STATUS_LABEL,
  supersededStampLines,
} = require("./workload.pdf");

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wlFixture = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  title: "Yuklama",
  department: { title: "Odam anatomiyasi kafedrasi" },
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2023/2024" },
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
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

describe("D-18 — almashtirilgan yuklama PDF'i", () => {
  test("altbilgida `superseded` holati bor (bo'sh emas)", () => {
    expect(FOOTER_STATUS_LABEL.superseded).toMatch(/Almashtirilgan/);
  });

  test("belgi matni: versiya va almashtirilgan sana", () => {
    const lines = supersededStampLines({
      status: "superseded",
      version: 1,
      supersededAt: new Date(2026, 8, 25),
    });
    expect(lines[0]).toBe("ALMASHTIRILGAN");
    expect(lines[1]).toContain("v1");
    expect(lines[1]).toContain("25.09.2026");
  });

  test("tasdiqlangan hujjatda belgi YO'Q", () => {
    expect(supersededStampLines({ status: "approved" })).toBeNull();
  });

  test("render: almashtirilgan hujjat — belgi va holat matnlari chiziladi", async () => {
    const texts = await render(
      wlFixture({ status: "superseded", version: 1, supersededAt: new Date(2026, 8, 25) }),
    );
    expect(texts).toContain("ALMASHTIRILGAN");
    expect(texts.some((t) => t.includes("Almashtirilgan (o'z kuchini yo'qotgan)"))).toBe(true);
  });

  test("render: tasdiqlangan hujjat — belgi chizilmaydi", async () => {
    const texts = await render(wlFixture({ status: "approved" }));
    expect(texts).not.toContain("ALMASHTIRILGAN");
  });
});
