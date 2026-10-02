const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const FOOTER_Y = 580;

const lpFixture = () => ({
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  keys: [{ key: "A", title: "Attestatsiyalar" }],
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [{ month: "Sen", weeks: [{ week: 1, key: "T" }] }],
      weeks: { 1: "T" },
      total: 41,
      statistics: [],
    },
  ],
  allValues: { total: 204, statistics: [] },
  comment: "Izoh",
  learningProcess: { keys: [{ key: "A", title: "Attestatsiyalar", week: 30 }] },
});

const planFixture = () => ({
  _id: "sp1",
  learningProcess: lpFixture(),
  blocks: [{ title: "MAJBURIY FANLAR", semesters: {}, sciences: [] }],
  meta: {},
});

const pageCount = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const render = async () => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(planFixture());
  StudyPlanModel.findById = jest.fn().mockReturnValue(chain);

  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => res.on("end", resolve));
    const next = jest.fn();
    await generateStudyPlanPdf({ params: { id: "sp1" }, query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    await done;
    return { buf: Buffer.concat(chunks), calls: spy.mock.calls };
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateStudyPlanPdf — footer va bo'sh betlar", () => {
  test("footerlar soni PDF'dagi sahifalar soniga teng (ortiqcha bet yo'q)", async () => {
    const { buf, calls } = await render();
    const footers = calls.filter((c) => c[2] === FOOTER_Y);
    expect(footers.length).toBeGreaterThan(0);
    expect(footers.length).toBe(pageCount(buf));
  });

  test("footer matni 1..N ketma-ketligi va N sahifalar soniga mos", async () => {
    const { buf, calls } = await render();
    const footers = calls.filter((c) => c[2] === FOOTER_Y).map((c) => c[0]);
    const n = pageCount(buf);
    expect(footers).toEqual(
      footers.map((_, i) => `O'quv reja  |  ${i + 1} / ${n}`),
    );
  });

  test("pastki hoshiya chizishdan keyin TIKLANADI (keyingi kod buzilmasin)", async () => {
    const { buf } = await render();
    expect(buf.slice(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.toString("latin1")).toContain("%%EOF");
  });
});
