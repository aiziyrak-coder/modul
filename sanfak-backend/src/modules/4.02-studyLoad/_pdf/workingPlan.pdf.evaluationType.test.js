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

const sci = (evaluationType) => ({
  code: "FA1001",
  title: "Oddiy fan",
  particle: particle(60),
  totalCredit: 2,
  weeklyHours: 2,
  evaluationType,
});

const wpFixture = (evaluationType) => {
  const semesters = new Map();
  for (const sem of ["1", "2"]) {
    semesters.set(sem, {
      blocks: [
        {
          blockCode: "MFI",
          title: "Majburiy fanlar",
          sciences: [sci(evaluationType)],
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
  stage: "I",
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

const renderTexts = async (evaluationType) => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(wpFixture(evaluationType)),
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

describe("workingPlan PDF — yakuniy baholash turi", () => {
  test("ma'lumotnomadan yozilgan MATN aynan chiziladi", async () => {
    const texts = await renderTexts("imtihon (yozma)");

    expect(texts).toContain("imtihon (yozma)");
  });

  test("qiymat yo'q — BO'SH katak (o'ylab topilgan qiymat YO'Q)", async () => {
    const texts = await renderTexts(null);

    expect(texts).not.toContain("test");
    expect(texts).not.toContain("imtihon");
  });

  test("3+ kreditli fanga ham \"imtihon\" O'YLAB TOPILMAYDI", async () => {
    const texts = await renderTexts("");

    expect(texts).not.toContain("imtihon");
    expect(texts).not.toContain("test");
  });
});
