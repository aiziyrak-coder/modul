jest.mock("#shared/pythonParser", () => ({
  parseReja: jest.fn(),
  fileUrlToPath: jest.fn(() => "/tmp/reja.xlsx"),
}));
jest.mock("#references/_services/educationActivityResolver", () => ({
  enrichMetaWithSlugRefs: jest.fn(async (m) => m),
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#references/science/science.model", () => ({ find: jest.fn() }));
jest.mock("./studyPlan.model", () => ({ create: jest.fn().mockResolvedValue({ _id: "sp1" }) }));

const { parseReja } = require("#shared/pythonParser");
const ScienceModel = require("#references/science/science.model");
const Controller = require("./studyPlan.controller");

const mockScience = (byCode) => {
  const docs = Object.entries(byCode).map(([code, v]) => ({
    _id: v._id,
    scienceCode: code,
    department: v.department,
  }));
  ScienceModel.find.mockReturnValue({
    select: () => ({ lean: async () => docs }),
  });
};

const sci = (code, title) => ({ code, title });

const runImport = async (sciences) => {
  parseReja.mockResolvedValue({
    meta: {},
    blocks: [{ sciences }],
  });
  const report = {
    total: 0,
    linked: 0,
    unlinkedCount: 0,
    unlinkedDistinct: 0,
    unlinked: [],
  };
  await Controller.subAddFormXlsx({
    file: "/files/reja.xlsx",
    learningProcess: "lp1",
    report,
  });
  return report;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("o'quv reja import hisoboti", () => {
  test("D-2: `Jami` va `HAMMASI` sanoqqa KIRMAYDI", async () => {
    mockScience({ FA1001: { _id: "s1", department: "d1" } });

    const report = await runImport([
      sci("FA1001", "Gigiyena"),
      sci(null, "Jami"),
      sci(null, "HAMMASI"),
    ]);

    expect(report.total).toBe(1);
    expect(report.linked).toBe(1);
    expect(report.unlinkedCount).toBe(0);
    expect(report.unlinked).toEqual([]);
  });

  test("kod YO'Q, lekin haqiqiy fan nomi — bog'lanmagan deb KO'RSATILADI", async () => {
    mockScience({});

    const report = await runImport([sci(null, "Fizika asoslari")]);

    expect(report.total).toBe(1);
    expect(report.unlinkedDistinct).toBe(1);
    expect(report.unlinked[0].title).toBe("Fizika asoslari");
  });

  test("BO'LIM SARLAVHASI (`Malakaviy amaliyot`) sanoqqa KIRMAYDI", async () => {
    mockScience({ FA1001: { _id: "s1", department: "d1" } });

    const report = await runImport([
      sci(null, "Malakaviy amaliyot"),
      sci("TM104", "Tanishuv amaliyoti"),
      sci("FA1001", "Gigiyena"),
    ]);

    expect(report.total).toBe(1);
    expect(report.linked).toBe(1);
    expect(report.unlinked).toEqual([]);
  });

  test("oraliq sarlavha serial PREFIKSI bo'yicha tanilib, sanoqqa kirmaydi", async () => {
    mockScience({ FS1104: { _id: "s1", department: "d1" } });

    const report = await runImport([
      { serialNumber: "1.1", code: null, title: "Ijtimoiy-gumanitar fanlar moduli" },
      { serialNumber: "1.1.01", code: "FS1104", title: "Falsafa" },
    ]);

    expect(report.total).toBe(1);
    expect(report.linked).toBe(1);
  });

  test("KODI BOR va nomi `Jami` — sanaladi (yig'indi emas, haqiqiy yozuv)", async () => {
    mockScience({});

    const report = await runImport([sci("FA9999", "Jami")]);

    expect(report.total).toBe(1);
    expect(report.unlinkedDistinct).toBe(1);
  });

  test("bog'lanmagan fan bir necha semestrda takrorlansa — ro'yxatda BIR marta", async () => {
    mockScience({});

    const report = await runImport([
      sci("FA2002", "Ekologiya"),
      sci("FA2002", "Ekologiya"),
    ]);

    expect(report.unlinkedCount).toBe(2);
    expect(report.unlinkedDistinct).toBe(1);
    expect(report.unlinked).toHaveLength(1);
  });
});

describe("D-120 kanonik kod taqqoslash — import yo'li (subAddFormXlsx)", () => {
  test("tire farqi — reja kodi GS12308, katalog GS12-308 — bog'lanadi", async () => {
    mockScience({ "GS12-308": { _id: "s1", department: "d1" } });

    const report = await runImport([sci("GS12308", "Fan")]);

    expect(report.linked).toBe(1);
    expect(report.unlinkedCount).toBe(0);
  });

  test("apostrof farqi (ASCII vs U+2018) — bog'lanadi", async () => {
    mockScience({ ["O‘YT1104"]: { _id: "s1", department: "d1" } });

    const report = await runImport([sci("O'YT1104", "Fan")]);

    expect(report.linked).toBe(1);
  });

  test("registr farqi — bog'lanadi", async () => {
    mockScience({ fa1200: { _id: "s1", department: "d1" } });

    const report = await runImport([sci("FA1200", "Fan")]);

    expect(report.linked).toBe(1);
  });

  test("noaniqlik qo'riqchisi — ikki katalog yozuvi bitta kanonik shaklga tushsa, bog'lanMAYDI", async () => {
    mockScience({
      "GS12-308": { _id: "s1", department: "d1" },
      GS12308: { _id: "s2", department: "d2" },
    });

    const report = await runImport([sci("GS12308", "Fan")]);

    expect(report.linked).toBe(0);
    expect(report.unlinkedCount).toBe(1);
  });
});
