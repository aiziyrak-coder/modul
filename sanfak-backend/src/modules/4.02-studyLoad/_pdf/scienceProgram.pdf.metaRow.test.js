const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const { buildScienceProgramPdf } = require("./scienceProgram.pdf");

const META_ROW_LABEL = "O'quv rejadagi tartib raqami";
const PAGE_NUMBER_Y = 797;

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const fixture = (overrides = {}) => ({
  title: null,
  confirmation: {},
  science: { name: "Ichki kasalliklar propedevtikasi" },
  label: null,
  directions: [],
  knowledgeArea: [],
  educationArea: [],
  code: "FA120",
  serialNumber: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  semester: "1",
  credits: 4,
  moduleType: "Tanlov",
  language: "o'zbek",
  weeklyHours: 6,
  hourItems: [
    { slug: "maruza", title: "Ma'ruza", value: 30 },
    { slug: "mustaqil", title: "Mustaqil ta' lim", value: 60 },
  ],
  classroomHours: 60,
  independentHours: 60,
  totalHours: 120,
  scienceEssence: null,
  theoretical: null,
  seminarRecommendation: null,
  independentTask: null,
  learningOutcome: null,
  teachingMethods: null,
  creditRequirements: null,
  literatureGroups: [],
  guidanceLiterature: null,
  primaryLiterature: null,
  additionalLiterature: null,
  informationSource: null,
  approval_info: null,
  responsible: null,
  reviewer: null,
  approvalSteps: [],
  barcode: null,
  status: "in_review",
  location: null,
  city: null,
  ...overrides,
});

const build = (overrides) => {
  ScienceProgram.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(fixture(overrides)));
  return buildScienceProgramPdf("sp");
};

const docToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

const pageCount = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const normalize = (buf) =>
  buf
    .toString("latin1")
    .replace(/\(D:\d{14}Z?\)/g, "(D:00000000000000Z)")
    .replace(/\/ID \[<[0-9a-f]+> <[0-9a-f]+>\]/g, "/ID [<0> <0>]");

const withTextSpy = async (fn) => {
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await fn();
    const buf = await docToBuffer(doc);
    return { buf, calls: spy.mock.calls };
  } finally {
    spy.mockRestore();
  }
};

const drewMetaRow = (calls) => calls.some((c) => c[0] === META_ROW_LABEL);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawMetaTable — §1 'O'quv rejadagi tartib raqami' qatori", () => {
  test("v142 + serialNumber — qator CHIZILADI", async () => {
    const { calls } = await withTextSpy(() =>
      build({ formVersion: "v142", serialNumber: "1.21" }),
    );
    expect(drewMetaRow(calls)).toBe(true);
    expect(calls.some((c) => c[0] === "1.21")).toBe(true);
  });

  test("v142, serialNumber null — qator baribir chiziladi (shablon talabi)", async () => {
    const { calls } = await withTextSpy(() =>
      build({ formVersion: "v142", serialNumber: null }),
    );
    expect(drewMetaRow(calls)).toBe(true);
  });

  test("v259 + serialNumber — qator CHIZILMAYDI (ADR-008 invariant #5)", async () => {
    const { calls } = await withTextSpy(() =>
      build({ formVersion: "v259", serialNumber: "1.21" }),
    );
    expect(drewMetaRow(calls)).toBe(false);
  });

  test("v259, serialNumber null — qator chizilmaydi", async () => {
    const { calls } = await withTextSpy(() =>
      build({ formVersion: "v259", serialNumber: null }),
    );
    expect(drewMetaRow(calls)).toBe(false);
  });

  test("formVersion umuman yo'q (legacy .lean()) + serialNumber — qator chizilmaydi", async () => {
    const doc = fixture({ serialNumber: "1.05" });
    delete doc.formVersion;
    ScienceProgram.findById = jest.fn().mockReturnValue(chainablePopulate(doc));
    const { calls } = await withTextSpy(() =>
      buildScienceProgramPdf("spLegacy"),
    );
    expect(drewMetaRow(calls)).toBe(false);
  });
});

describe("v259 NON-REPUDIATION qulfi (ADR-008 invariant #5)", () => {
  test("serialNumber to'la va bo'sh v259 hujjatlari — §1 jadval va butun tana bir xil, FAQAT muqova «Ro'yxatga olindi» qatori farq qiladi (A-13)", async () => {
    const directions = [{ name: "Davolash ishi", directionCode: "60910200" }];
    const filled = await withTextSpy(() =>
      build({ formVersion: "v259", serialNumber: "1.05", directions }),
    );
    const empty = await withTextSpy(() =>
      build({ formVersion: "v259", serialNumber: null, directions }),
    );
    const REG = "Ro'yxatga olindi: № ";
    const texts = (calls) => calls.map((c) => c[0]).filter((s) => typeof s === "string");
    const reg = (calls) => texts(calls).filter((s) => s.startsWith(REG));
    expect(reg(filled.calls)).toEqual([`${REG}60910200 1.05`]);
    expect(reg(empty.calls)).toEqual([`${REG}________`]);
    const rest = (calls) => texts(calls).filter((s) => !s.startsWith(REG));
    expect(rest(filled.calls)).toEqual(rest(empty.calls));
    expect(drewMetaRow(filled.calls)).toBe(false);
    expect(drewMetaRow(empty.calls)).toBe(false);
  });

  test("yo'nalish kodi BO'LMASA — serialNumber to'la va bo'sh v259 hujjatlari hamon AYNAN bir xil bayt beradi (ro'yxat qatori ikkalasida bo'sh chiziq)", async () => {
    const filled = await docToBuffer(
      await build({ formVersion: "v259", serialNumber: "1.05", directions: [] }),
    );
    const empty = await docToBuffer(
      await build({ formVersion: "v259", serialNumber: null, directions: [] }),
    );
    expect(normalize(filled)).toBe(normalize(empty));
  });

  test("legacy (formVersion yo'q) hujjat ham serialNumber'dan qat'i nazar bir xil", async () => {
    const mk = (serialNumber) => {
      const d = fixture({ serialNumber });
      delete d.formVersion;
      ScienceProgram.findById = jest.fn().mockReturnValue(chainablePopulate(d));
      return buildScienceProgramPdf("spLegacy");
    };
    const filled = await docToBuffer(await mk("1.05"));
    const empty = await docToBuffer(await mk(null));
    expect(normalize(filled)).toBe(normalize(empty));
  });
});

describe("drawPageNumbers — bo'sh sahifa qo'shilmaydi", () => {
  const expectNumbersMatchPages = async (overrides) => {
    const { buf, calls } = await withTextSpy(() => build(overrides));
    const numbers = calls.filter((c) => c[2] === PAGE_NUMBER_Y);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.length).toBe(pageCount(buf));
    return { buf, numbers };
  };

  test("v259 — har sahifada bitta raqam, ortiqcha bet yo'q", async () => {
    const { numbers } = await expectNumbersMatchPages({
      formVersion: "v259",
      serialNumber: "1.05",
    });
    expect(numbers.map((c) => c[0])).toEqual(
      numbers.map((_, i) => String(i + 1)),
    );
  });

  test("v142 — muqova raqamsiz, qolgan betlarda «2»..N, ortiqcha bet yo'q", async () => {
    const { buf, calls } = await withTextSpy(() =>
      build({ formVersion: "v142", serialNumber: "1.07" }),
    );
    const numbers = calls.filter((c) => c[2] === PAGE_NUMBER_Y);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.length).toBe(pageCount(buf) - 1);
    expect(numbers.map((c) => c[0])).toEqual(
      numbers.map((_, i) => String(i + 2)),
    );
  });
});
