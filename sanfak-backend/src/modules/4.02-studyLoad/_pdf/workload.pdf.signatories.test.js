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
  department: { title: "Stomatologiya kafedrasi" },
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  directions: [],
  approvalSteps: [],
  agreed: {},
  confirmation: {},
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
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

const approved = (step, name) => ({
  step,
  status: "approved",
  approvedBy: { lastName: name[0], firstName: name[1] },
  date: new Date(2026, 8, 3),
});

describe("KELISHILDI/TASDIQLAYMAN — zanjirdan avto-to'ldirish", () => {
  test("prorektor approved bo'lsa — KELISHILDI blokida ism va sana chiziladi", async () => {
    const t = await render(
      wlFixture({ approvalSteps: [approved("prorektor", ["Boltaboyev", "U."])] }),
    );
    expect(t).toContain("U.Boltaboyev");
    expect(t).toContain('2026-yil " 3 " sentabr');
  });

  test("rektor approved bo'lsa — TASDIQLAYMAN blokida ism chiziladi", async () => {
    const t = await render(
      wlFixture({ approvalSteps: [approved("rektor", ["Karimov", "R."])] }),
    );
    expect(t).toContain("R.Karimov");
  });

  test("hech biri approved bo'lmasa — shablon sana chiziladi, ism yo'q", async () => {
    const t = await render(wlFixture());
    expect(t).toContain('202__ yil "___" ________');
  });
});

describe("O'UB/Reja-moliya — faqat ism (blanka: sanasiz)", () => {
  test("methodical approved bo'lsa — O'quv-uslubiy boshqarma qatorida ism chiziladi", async () => {
    const t = await render(
      wlFixture({ approvalSteps: [approved("methodical", ["Nodirov", "A."])] }),
    );
    expect(t).toContain("A.Nodirov");
  });

  test("financial approved bo'lsa — Reja-moliya qatorida ism chiziladi", async () => {
    const t = await render(
      wlFixture({ approvalSteps: [approved("financial", ["Yusupova", "N."])] }),
    );
    expect(t).toContain("N.Yusupova");
  });

  test("kafedra approved bo'lsa — «Kafedra mudiri:» qatorida ism chiziladi (2026-09-16, mijoz №3)", async () => {
    const t = await render(
      wlFixture({ approvalSteps: [approved("kafedra", ["Umarov", "O."])] }),
    );
    expect(t).toContain("Kafedra mudiri:");
    expect(t).toContain("O.Umarov");
  });

  test("kafedra approved bo'lmasa — «Kafedra mudiri:» sloti bor, lekin ism yo'q", async () => {
    const t = await render(wlFixture());
    expect(t).toContain("Kafedra mudiri:");
    expect(t.some((s) => s.includes("Umarov"))).toBe(false);
  });

  test("populate qilinmagan xom ObjectId `methodicalHead.leader` — hech qachon chizilmaydi", async () => {
    const rawId = { toString: () => "6a7d69082200e50d919e2b3a" };
    const t = await render(
      wlFixture({ methodicalHead: { leader: rawId } }),
    );
    const leaked = t.some((s) => s.includes("6a7d69082200e50d919e2b3a"));
    expect(leaked).toBe(false);
  });
});
