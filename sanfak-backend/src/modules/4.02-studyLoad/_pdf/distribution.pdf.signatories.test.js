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

const distFixture = (overrides = {}) => ({
  title: null,
  confirmation: {},
  department: { title: "Gigiyena va ekologiya kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  teachers: [],
  staffPositions: { items: [], totalPositions: 36, hourly: 0 },
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
  approvalSteps: [],
  ...overrides,
});

const render = async (dist) => {
  WorkloadDistribution.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(dist));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildDistributionPdf("dist1");
    doc.end();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

const approved = (step, lastName, firstName) => ({
  step,
  status: "approved",
  approvedBy: { lastName, firstName },
  date: new Date(2026, 8, 3),
});

describe("TASDIQLAYMAN — zanjirdan avto-to'ldirish", () => {
  test("prorektor approved bo'lsa — ism va sana chiziladi (qo'lda blok bo'sh)", async () => {
    const t = await render(
      distFixture({ approvalSteps: [approved("prorektor", "Boltaboyev", "U.")] }),
    );
    expect(t).toContain("U.Boltaboyev");
  });

  test("hech biri approved bo'lmasa — F.I.O chizilmaydi", async () => {
    const t = await render(distFixture());
    expect(t.some((s) => s.includes("Boltaboyev"))).toBe(false);
  });
});

describe("O'UB/Reja-moliya/Kafedra mudiri — faqat ism (blanka: sanasiz)", () => {
  test("methodical approved bo'lsa — O'quv-uslubiy boshqarma qatorida ism chiziladi", async () => {
    const t = await render(
      distFixture({ approvalSteps: [approved("methodical", "Nodirov", "A.")] }),
    );
    expect(t).toContain("A.Nodirov");
  });

  test("financial approved bo'lsa — Reja-moliya qatorida ism chiziladi", async () => {
    const t = await render(
      distFixture({ approvalSteps: [approved("financial", "Yusupova", "N.")] }),
    );
    expect(t).toContain("N.Yusupova");
  });

  test("kafedra approved bo'lsa — Kafedra mudiri qatorida ism chiziladi", async () => {
    const t = await render(
      distFixture({ approvalSteps: [approved("kafedra", "Qosimov", "B.")] }),
    );
    expect(t).toContain("B.Qosimov");
  });

  test("populate qilinmagan xom ObjectId `departmentHead.manager` — hech qachon chizilmaydi", async () => {
    const rawId = { toString: () => "6a7d69082200e50d919e2b3a" };
    const t = await render(
      distFixture({ departmentHead: { manager: rawId } }),
    );
    const leaked = t.some((s) => s.includes("6a7d69082200e50d919e2b3a"));
    expect(leaked).toBe(false);
  });
});
