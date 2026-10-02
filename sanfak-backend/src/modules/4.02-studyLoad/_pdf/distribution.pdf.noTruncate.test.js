const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#references/position/position.model");

const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const Position = require("#references/position/position.model");
const { buildDistributionPdf } = require("./distribution.pdf");

const LONG_TITLE =
  "Amaliyotlar: Umumiy amaliyot stomatolog shifokor yordamchisi — klinik bazada malakaviy amaliyot (uzun nom, blanka 5-bet)";
const LONG_BAND_SPEC =
  "Terapevtik va ortopedik stomatologiya, yuz-jag' jarrohligi, bolalar stomatologiyasi va ortodontiya";

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const distFixture = () => ({
  title: null,
  confirmation: {},
  department: { title: "Stomatologiya kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  teachers: [
    {
      teacher: { lastName: "Abdukarimova", firstName: "Nodira", middleName: "Mansur qizi", phone: "+998901234567" },
      stavka: 1,
      position: "assistent",
      specialization: LONG_BAND_SPEC,
      blocks: [
        {
          science: { title: LONG_TITLE },
          course: 4,
          student: 14,
          totalHour: 60,
          studyWork: { group: 1, stream: 1, semester: 8, thisSemester: { totalHour: 60, auditoriumHour: 60 } },
        },
      ],
    },
  ],
  staffPositions: { items: [], totalPositions: 0, hourly: 0 },
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
});

const render = async (dist) => {
  WorkloadDistribution.findById = jest.fn().mockReturnValue(chainablePopulate(dist));
  Position.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });
  const textSpy = jest.spyOn(PDFDocument.prototype, "text");
  const rectSpy = jest.spyOn(PDFDocument.prototype, "rect");
  try {
    const doc = await buildDistributionPdf("dist1");
    doc.end();
    return { texts: textSpy.mock.calls, rects: rectSpy.mock.calls };
  } finally {
    textSpy.mockRestore();
    rectSpy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("distribution.pdf — jadvalda matn kesilmaydi (ellipsis yo'q, o'raladi)", () => {
  test("hech bir doc.text chaqiruvi `ellipsis` bilan kelmaydi", async () => {
    const { texts } = await render(distFixture());
    const withEllipsis = texts.filter((c) => c[3] && c[3].ellipsis);
    expect(withEllipsis).toEqual([]);
  });

  test("uzun fan nomi TO'LIQ va lineBreak:true bilan chiziladi", async () => {
    const { texts } = await render(distFixture());
    const call = texts.find((c) => c[0] === LONG_TITLE);
    expect(call).toBeDefined();
    expect(call[3].lineBreak).toBe(true);
  });

  test("uzun o'qituvchi bandi (mutaxassislik + telefon) to'liq matn bilan chiziladi", async () => {
    const { texts } = await render(distFixture());
    const band = texts.map((c) => c[0]).find((t) => typeof t === "string" && t.includes(LONG_BAND_SPEC));
    expect(band).toBeDefined();
    expect(band).toContain("+998901234567");
  });

  test("uzun matnli qator balandligi minimal ROW_H (12) dan katta — rect balandligi o'sadi", async () => {
    const { rects } = await render(distFixture());
    const scienceCells = rects
      .filter((c) => c[0] === 18 && c[2] === 210 && c[3] < 40)
      .map((c) => c[3]);
    expect(scienceCells.length).toBeGreaterThan(0);
    expect(Math.max(...scienceCells)).toBeGreaterThan(12);
  });
});
