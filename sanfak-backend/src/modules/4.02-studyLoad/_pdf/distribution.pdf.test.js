const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");

const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { buildDistributionPdf } = require("./distribution.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const baseFixture = (academicYear) => ({
  title: null,
  confirmation: {},
  department: { title: "Ichki kasalliklar kafedrasi" },
  date: null,
  academicYear,
  status: "draft",
  teachers: [],
  staffPositions: null,
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildDistributionPdf — academicYear ObjectId ref (D-094 regressiya)", () => {
  test("populate qilingan { title } bo'lsa — PDF xatosiz quriladi", async () => {
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(
        chainablePopulate(
          baseFixture({ _id: new mongoose.Types.ObjectId(), title: "2025/2026" }),
        ),
      );

    const doc = await buildDistributionPdf("distId1");
    expect(() => doc.end()).not.toThrow();
  });

  test("populate qilinmagan xom ObjectId bo'lsa — xato otilmaydi va PDF matnida hex chiqmaydi", async () => {
    const rawId = new mongoose.Types.ObjectId();
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(baseFixture(rawId)));

    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildDistributionPdf("distId2");
    doc.end();

    const leaked = textSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes(rawId.toString()),
    );
    expect(leaked).toBe(false);
    textSpy.mockRestore();
  });

  test("academicYear null bo'lsa ham xatosiz quriladi", async () => {
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(baseFixture(null)));

    await expect(buildDistributionPdf("distId3")).resolves.toBeDefined();
  });

  test("query zanjiriga `academicYear` populate qo'shilgan", async () => {
    const chain = chainablePopulate(baseFixture(null));
    WorkloadDistribution.findById = jest.fn().mockReturnValue(chain);

    await buildDistributionPdf("distId4");

    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
  });
});

describe("buildDistributionPdf — teachers.blocks.science ustuni (fan nomi bo'sh chiqish regressiyasi)", () => {
  const blockFixture = (scienceOverride, extra = {}) => ({
    isVacant: true,
    blocks: [
      {
        science: scienceOverride,
        practiceTitle: null,
        course: 1,
        student: 20,
        studyWork: {},
        totalHour: 30,
        ...extra,
      },
    ],
  });

  test("query zanjiriga `teachers.blocks.science` `title scienceCode` bilan populate qilingan", async () => {
    const chain = chainablePopulate(baseFixture(null));
    WorkloadDistribution.findById = jest.fn().mockReturnValue(chain);

    await buildDistributionPdf("distId5");

    expect(chain.populate).toHaveBeenCalledWith(
      "teachers.blocks.science",
      "title scienceCode",
    );
  });

  test("science populate qilingan { title, scienceCode } bo'lsa — jadvalda fan nomi (title) chiqadi", async () => {
    const fixture = baseFixture(null);
    fixture.teachers = [blockFixture({ title: "Ichki kasalliklar", scienceCode: "IK-101" })];
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(fixture));

    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildDistributionPdf("distId6");
    doc.end();

    const hasTitle = textSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes("Ichki kasalliklar"),
    );
    expect(hasTitle).toBe(true);
    textSpy.mockRestore();
  });

  test("science populate qilinmagan (null) va practiceTitle ham yo'q bo'lsa — '—' chiqadi, xato otilmaydi", async () => {
    const fixture = baseFixture(null);
    fixture.teachers = [blockFixture(null)];
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(fixture));

    await expect(buildDistributionPdf("distId7")).resolves.toBeDefined();
  });

  test("science null, lekin practiceTitle bor bo'lsa — practiceTitle fallback ishlaydi", async () => {
    const fixture = baseFixture(null);
    fixture.teachers = [blockFixture(null, { practiceTitle: "Amaliyot: Stomatologiya" })];
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(fixture));

    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildDistributionPdf("distId8");
    doc.end();

    const hasPracticeTitle = textSpy.mock.calls.some(
      (call) =>
        typeof call[0] === "string" && call[0].includes("Amaliyot: Stomatologiya"),
    );
    expect(hasPracticeTitle).toBe(true);
    textSpy.mockRestore();
  });

  test("REGRESSIYA QULFI: eski { name, code } shaklidagi obyekt kelsa ham '—' chiqadi (title/scienceCode YO'Q, name/code EMAS)", async () => {
    const fixture = baseFixture(null);
    fixture.teachers = [
      blockFixture({ name: "Eski nom maydoni", code: "ESKI-1" }),
    ];
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(fixture));

    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildDistributionPdf("distId9");
    doc.end();

    const leakedOldFieldName = textSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes("Eski nom maydoni"),
    );
    const hasDash = textSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0] === "—",
    );
    expect(leakedOldFieldName).toBe(false);
    expect(hasDash).toBe(true);
    textSpy.mockRestore();
  });
});

describe("buildDistributionPdf — dars turi yorlig'i (ADR-034, egasi Q3)", () => {
  const renderTexts = async (fixture, id) => {
    WorkloadDistribution.findById = jest.fn().mockReturnValue(chainablePopulate(fixture));
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    try {
      const doc = await buildDistributionPdf(id);
      doc.end();
      return textSpy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
    } finally {
      textSpy.mockRestore();
    }
  };
  const entryWith = (extra) => ({
    isVacant: true,
    blocks: [
      {
        science: { title: "Ichki kasalliklar", scienceCode: "IK-101" },
        practiceTitle: null,
        course: 1,
        student: 20,
        studyWork: {
          classTypes: [
            { slug: "maruza", title: "Ma'ruza", stream: 2, total: 2 },
            { slug: "amaliy", title: "Amaliy mashg'ulot", stream: 0, total: 0 },
          ],
        },
        totalHour: 17,
        ...extra,
      },
    ],
  });

  test("classTypeSlugs ['maruza'] → «Ichki kasalliklar (Ma'ruza)»", async () => {
    const fixture = baseFixture(null);
    fixture.teachers = [entryWith({ classTypeSlugs: ["maruza"] })];
    const texts = await renderTexts(fixture, "distId-split");
    expect(texts.some((t) => t.includes("Ichki kasalliklar (Ma'ruza)"))).toBe(true);
  });

  test("classTypeSlugs yo'q / [] → nom o'zgarmaydi (qavs yo'q)", async () => {
    const fixture = baseFixture(null);
    fixture.teachers = [entryWith({ classTypeSlugs: [] })];
    const texts = await renderTexts(fixture, "distId-plain");
    expect(texts.some((t) => t === "Ichki kasalliklar")).toBe(true);
    expect(texts.some((t) => t.includes("Ichki kasalliklar ("))).toBe(false);
  });
});
