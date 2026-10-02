const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const { buildScienceProgramPdf } = require("./scienceProgram.pdf");

const MINISTRY_LINES = [
  "O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI",
  "O'ZBEKISTON RESPUBLIKASI OLIY TA'LIM, FAN VA INNOVATSIYALAR VAZIRLIGI",
  "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI",
];
const DOC_TITLE = "Kommunal gigiyena — fan dasturi (2026/2027)";

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const fixture = (overrides = {}) => ({
  title: null,
  confirmation: {},
  science: { name: "Kommunal gigiyena" },
  label: null,
  directions: [],
  knowledgeArea: [],
  educationArea: [],
  code: "FA120",
  serialNumber: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2026/2027" },
  semester: "1",
  credits: 4,
  moduleType: "Tanlov",
  language: "o'zbek",
  weeklyHours: 6,
  hourItems: [],
  classroomHours: 60,
  independentHours: 60,
  totalHours: 120,
  literatureGroups: [],
  approvalSteps: [],
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

const normalize = (buf) =>
  buf
    .toString("latin1")
    .replace(/\(D:\d{14}Z?\)/g, "(D:00000000000000Z)")
    .replace(/\/ID \[<[0-9a-f]+> <[0-9a-f]+>\]/g, "/ID [<0> <0>]");

const withTextSpy = async (fn) => {
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await fn();
    await docToBuffer(doc);
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawCoverPage — vazirlik/institut sarlavhasi (C1)", () => {
  test.each([
    ["v142", "v142"],
    ["v259", "v259"],
  ])("%s: title BO'SH bo'lganda uch qator chiziladi", async (_n, fv) => {
    const t = await withTextSpy(() => build({ formVersion: fv, title: null }));
    for (const line of MINISTRY_LINES) expect(t).toContain(line);
  });

  test.each([
    ["v142", "v142"],
    ["v259", "v259"],
  ])("%s: title TO'LGANDA ham uch qator chiziladi", async (_n, fv) => {
    const t = await withTextSpy(() =>
      build({ formVersion: fv, title: DOC_TITLE }),
    );
    for (const line of MINISTRY_LINES) expect(t).toContain(line);
  });

  test("hujjatning DB sarlavhasi (`sp.title`) zarvaraqni almashtirmaydi", async () => {
    const t = await withTextSpy(() =>
      build({ formVersion: "v142", title: DOC_TITLE }),
    );
    expect(t).not.toContain(DOC_TITLE);
  });

  test("fan nomi va hujjat turi hamon o'z joyida chiziladi", async () => {
    const t = await withTextSpy(() =>
      build({ formVersion: "v142", title: DOC_TITLE }),
    );
    expect(t).toContain("KOMMUNAL GIGIYENA");
    expect(t).toContain("FANINING O'QUV DASTURI");
  });
});

describe("drawCoverPage — meta qatorlar DOIM chiziladi (A6)", () => {
  test("sohalar bo'sh bo'lsa ham 3 yorliq bor, qiymat o'rnida `—`", async () => {
    const t = await withTextSpy(() =>
      build({ knowledgeArea: [], educationArea: [], directions: [] }),
    );
    expect(t).toContain("Bilim sohasi:");
    expect(t).toContain("Ta'lim sohasi:");
    expect(t).toContain("Ta'lim yo'nalishi:");
    expect(t.filter((s) => s === "—").length).toBeGreaterThanOrEqual(3);
  });

  test("yo'nalish shifri bo'lsa — `60910200 – Davolash ishi` shaklida", async () => {
    const t = await withTextSpy(() =>
      build({
        directions: [{ name: "Davolash ishi", directionCode: "60910200" }],
      }),
    );
    expect(t).toContain("60910200 – Davolash ishi");
  });

  test("shifr yo'q bo'lsa — faqat nom (tire qo'shilmaydi)", async () => {
    const t = await withTextSpy(() =>
      build({ directions: [{ name: "Davolash ishi" }] }),
    );
    expect(t).toContain("Davolash ishi");
    expect(t.filter((s) => s.includes("–") && s.includes("Davolash ishi"))).toHaveLength(0);
  });

  test("to'lgan sohalar o'z qiymati bilan chiziladi (`—` bilan almashmaydi)", async () => {
    const t = await withTextSpy(() =>
      build({
        knowledgeArea: ["900000 - Sog'liqni saqlash"],
        educationArea: ["910000 - Sog'liqni saqlash"],
      }),
    );
    expect(t).toContain("900000 - Sog'liqni saqlash");
    expect(t).toContain("910000 - Sog'liqni saqlash");
  });
});

const DIR_AREAS = {
  name: "Davolash ishi",
  directionCode: "60910200",
  knowledgeArea: "900000 – Sog'liqni saqlash va ijtimoiy ta'minot",
  educationArea: "910000 – Sog'liqni saqlash",
};
const valueOf = (t, label) => t[t.indexOf(label) + 1];

describe("drawCoverPage — D-9 soha yo'nalishdan (ADR-044)", () => {
  test.each([["v259"], ["v142"]])("%s: o'z sohasi bo'sh — yo'nalishdagi soha chiziladi", async (fv) => {
    const t = await withTextSpy(() => build({ formVersion: fv, directions: [DIR_AREAS] }));
    expect(valueOf(t, "Bilim sohasi:")).toBe("900000 – Sog'liqni saqlash va ijtimoiy ta'minot");
    expect(valueOf(t, "Ta'lim sohasi:")).toBe("910000 – Sog'liqni saqlash");
  });

  test("v259: o'z sohasi ustun — yo'nalishdagisi chizilmaydi", async () => {
    const t = await withTextSpy(() =>
      build({ formVersion: "v259", knowledgeArea: ["Tibbiyot"], educationArea: ["Stomatologiya"], directions: [DIR_AREAS] }),
    );
    expect(valueOf(t, "Bilim sohasi:")).toBe("Tibbiyot");
    expect(valueOf(t, "Ta'lim sohasi:")).toBe("Stomatologiya");
  });

  test("v259: ikki yo'nalishda bir xil soha — bir marta", async () => {
    const twin = { ...DIR_AREAS, name: "Pediatriya ishi", directionCode: "60910300" };
    const t = await withTextSpy(() => build({ formVersion: "v259", directions: [DIR_AREAS, twin] }));
    expect(valueOf(t, "Ta'lim sohasi:")).toBe("910000 – Sog'liqni saqlash");
  });
});

describe("v259 NON-REPUDIATION — D-9 boshqa holatda baytga tegmaydi", () => {
  test("yo'nalishda soha bo'sh (null / '') — maydonsiz yo'nalish bilan AYNAN bir xil bayt", async () => {
    const bare = { name: "Davolash ishi", directionCode: "60910200" };
    const nulls = { ...bare, knowledgeArea: null, educationArea: "" };
    const a = await docToBuffer(await build({ formVersion: "v259", directions: [bare] }));
    const b = await docToBuffer(await build({ formVersion: "v259", directions: [nulls] }));
    expect(normalize(b)).toBe(normalize(a));
  });

  test("o'z sohasi to'la — yo'nalishdagi soha baytga ta'sir qilmaydi", async () => {
    const own = { formVersion: "v259", knowledgeArea: ["Tibbiyot"], educationArea: ["Stomatologiya"] };
    const bare = { name: "Davolash ishi", directionCode: "60910200" };
    const a = await docToBuffer(await build({ ...own, directions: [bare] }));
    const b = await docToBuffer(await build({ ...own, directions: [DIR_AREAS] }));
    expect(normalize(b)).toBe(normalize(a));
  });
});

describe("v259 NON-REPUDIATION — `title` chiqishga ta'sir qilmaydi", () => {
  test("title to'la va bo'sh v259 hujjatlari AYNAN bir xil bayt beradi", async () => {
    const filled = await docToBuffer(
      await build({ formVersion: "v259", title: DOC_TITLE }),
    );
    const empty = await docToBuffer(
      await build({ formVersion: "v259", title: null }),
    );
    expect(normalize(filled)).toBe(normalize(empty));
  });
});
