const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const particle = (h) => [
  { canonical: "hour", value: h },
  { canonical: "lecture", value: 10 },
  { canonical: "practical", value: 14 },
  { canonical: "independent", value: 30 },
];

const row = (serialNumber, code, title, credit = 2) => ({
  serialNumber,
  code,
  title,
  particle: particle(60),
  totalCredit: credit,
  weeklyHours: 2,
  evaluationType: null,
});

const wpFixture = () => {
  const semesters = new Map();
  for (const sem of ["1", "2"]) {
    semesters.set(sem, {
      blocks: [
        {
          blockCode: "MF1",
          title: "Majburiy fanlar",
          sciences: [
            row("1.2.", "", "Klinika oldi fanlari moduli", 4),
            row("1.2.12", "KAN1504", "Klinik anatomiya", 2),
            row("1.2.13", "PAN1606", "Patologik anatomiya", 2),
            row("", "", "Jami", 4),
          ],
        },
      ],
    });
  }
  return { _id: "wp1", workingSchedule: "ws1", semesters, studyPlanLabel: null };
};

const wsFixture = () => ({
  agreed: {},
  confirmation: {},
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicLevel: null,
  educationForm: null,
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { title: "2030/2031" },
  stage: "VI",
  desc: null,
  courses: [],
  keys: [],
  statistics: {},
  attestationNote: null,
  allValues: {},
  comment: null,
  comments: null,
  methodicalHead: null,
  facultyDean: null,
  approval: null,
});

const chain = (doc) => {
  const c = {};
  c.populate = jest.fn().mockReturnValue(c);
  c.exec = jest.fn().mockResolvedValue(doc);
  return c;
};

const renderTexts = async () => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(wpFixture()),
  });
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain(wsFixture()));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("workingPlan PDF — ierarxiya sarlavhasi jadvalga CHIZILMAYDI", () => {
  test("modul sarlavhasi ('… moduli') hech bir jadvalda yo'q", async () => {
    const texts = await renderTexts();
    expect(texts).not.toContain("Klinika oldi fanlari moduli");
  });

  test("haqiqiy fanlar (leaf) O'Z O'RNIDA qoladi", async () => {
    const texts = await renderTexts();
    expect(texts).toContain("Klinik anatomiya");
    expect(texts).toContain("Patologik anatomiya");
    expect(texts).toContain("KAN1504");
  });

  test("'Jami' qatori faqat PDF o'zi chizadigan quyruq qatori sifatida qoladi", async () => {
    const texts = await renderTexts();
    expect(texts).toContain("Jami");
    expect(texts).toContain("Jami semestrda");
  });
});
