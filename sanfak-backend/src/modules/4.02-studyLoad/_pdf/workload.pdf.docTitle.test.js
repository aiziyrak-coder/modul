const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf } = require("./workload.pdf");

const DEPARTMENT = "Gigiyena va ekologiya kafedrasi";

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wlFixture = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  title: null,
  department: { title: DEPARTMENT },
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
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawApprovalHeader — hujjat sarlavhasidagi 'ning'", () => {
  test("ajralgan \" ning \" hech qaysi matnda YO'Q", async () => {
    const texts = await render(wlFixture());
    expect(texts.filter((t) => t.includes(" ning "))).toEqual([]);
  });

  test("kafedra nomi + 'ning' qo'shilib yoziladi (blanka: '…kafedrasining')", async () => {
    const texts = await render(wlFixture());
    expect(
      texts.some((t) => t.includes(`${DEPARTMENT}ning 2026/2027`)),
    ).toBe(true);
  });

  test("kafedra bo'lmasa ham qo'shimcha ajralmaydi ('Kafedraning')", async () => {
    const texts = await render(wlFixture({ department: null }));
    expect(texts.some((t) => t.includes("Kafedraning 2026/2027"))).toBe(true);
    expect(texts.filter((t) => t.includes(" ning "))).toEqual([]);
  });

  test("`title` bazada bo'lsa — AYNAN u ishlatiladi (zaxira shox emas)", async () => {
    const custom = "Gigiyena va ekologiya kafedrasining 2026/2027 o'quv yili";
    const texts = await render(wlFixture({ title: custom }));
    expect(texts).toContain(custom);
  });
});
