const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const {
  buildScienceProgramPdf,
  buildAutoApprovalInfo,
  chainHasDeanStep,
} = require("./scienceProgram.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const DEAN = { firstName: "Malika", lastName: "Rasulova" };
const REKTOR = { firstName: "Akmal", lastName: "Sidikov" };

const B1_APPROVED = [
  { step: "teacher", status: "approved", date: new Date("2026-09-01") },
  { step: "kafedra", status: "approved", date: new Date("2026-09-02"), protocol: "3" },
  { step: "arm", status: "approved", date: new Date("2026-09-03") },
  { step: "methodical", status: "approved", date: new Date("2026-09-04"), protocol: "9" },
  { step: "dean", status: "approved", date: new Date("2026-09-22"), protocol: "5", approvedBy: DEAN },
];
const LEGACY_APPROVED = [
  { step: "teacher", status: "approved", date: new Date("2026-09-01") },
  { step: "kafedra", status: "approved", date: new Date("2026-09-02"), protocol: "3" },
  { step: "arm", status: "approved", date: new Date("2026-09-03") },
  { step: "methodical", status: "approved", date: new Date("2026-09-04"), protocol: "9" },
  { step: "prorektor", status: "approved", date: new Date("2026-09-05") },
  { step: "rektor", status: "approved", date: new Date("2026-09-15"), protocol: "12", approvedBy: REKTOR },
];

const fixture = (overrides = {}) => ({
  title: null,
  formVersion: "v259",
  confirmation: {},
  science: { name: "Mikrobiologiya, virusologiya, immunologiya 1,2" },
  label: null,
  directions: [
    {
      name: "Davolash ishi",
      directionCode: "60110100",
      faculty: { title: "Davolash ishi fakulteti" },
    },
  ],
  knowledgeArea: [],
  educationArea: [],
  code: "MVI11104",
  serialNumber: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2026/2027" },
  semester: "1",
  credits: 4,
  moduleType: "Majburiy",
  language: "o'zbek",
  weeklyHours: 6,
  hourItems: [],
  classroomHours: 60,
  independentHours: 60,
  totalHours: 120,
  literatureGroups: [],
  approvalSteps: [],
  status: "approved",
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

beforeEach(() => jest.clearAllMocks());

describe("chainHasDeanStep — hujjatning o'z zanjiri", () => {
  test("B1 / v142 zanjir — true; legacy 6 bosqich — false; bo'sh — false", () => {
    expect(chainHasDeanStep({ approvalSteps: B1_APPROVED })).toBe(true);
    expect(
      chainHasDeanStep({
        approvalSteps: [{ step: "teacher" }, { step: "kafedra" }, { step: "dean" }],
      }),
    ).toBe(true);
    expect(chainHasDeanStep({ approvalSteps: LEGACY_APPROVED })).toBe(false);
    expect(chainHasDeanStep({ approvalSteps: [] })).toBe(false);
    expect(chainHasDeanStep({})).toBe(false);
  });
});

describe("v259 muqova «TASDIQLAYMAN» — zanjirdan read-time (ADR-035 K2)", () => {
  const REKTOR_POSITION = "Farg'ona jamoat salomatligi tibbiyot instituti rektori";

  test("B1 hujjat (dean approved) — «Davolash ishi fakulteti dekani» + dekan ismi; rektor matni YO'Q", async () => {
    const t = await withTextSpy(() => build({ approvalSteps: B1_APPROVED }));
    expect(t).toContain("Davolash ishi fakulteti dekani");
    expect(t.some((x) => /Rasulova/.test(x))).toBe(true);
    expect(t).not.toContain(REKTOR_POSITION);
  });

  test("legacy 6 bosqichli hujjat (rektor approved) — eski rektor bloki, dekan matni YO'Q", async () => {
    const t = await withTextSpy(() => build({ approvalSteps: LEGACY_APPROVED }));
    expect(t).toContain(REKTOR_POSITION);
    expect(t.some((x) => /Sidikov/.test(x))).toBe(true);
    expect(t.some((x) => /fakulteti dekani/.test(x))).toBe(false);
  });

  test("B1 hujjat, dean hali pending — dekan bloki (ismsiz), rektor matni YO'Q", async () => {
    const steps = B1_APPROVED.map((s) =>
      s.step === "dean" ? { step: "dean", status: "pending" } : s,
    );
    const t = await withTextSpy(() =>
      build({ approvalSteps: steps, status: "in_review" }),
    );
    expect(t).toContain("Davolash ishi fakulteti dekani");
    expect(t).not.toContain(REKTOR_POSITION);
    expect(t.some((x) => /Rasulova/.test(x))).toBe(false);
  });
});

describe("7-band — bayonnoma matni (ADR-035, egasi: «fakulteti Kengashining»)", () => {
  const PREFIX =
    "Fan dasturi Oliy ta'lim yo'nalishlari va mutaxassisliklari bo'yicha ";

  test("dean bosqichi (protocol 5) — fakultet Kengashi matni, dekan sanasi", () => {
    const txt = buildAutoApprovalInfo(fixture({ approvalSteps: B1_APPROVED }));
    expect(txt).toBe(
      PREFIX +
        "Davolash ishi fakulteti Kengashining 2026-yil 22-sentabrdagi " +
        "5-sonli bayonnomasi bilan ma'qullangan.",
    );
  });

  test("legacy rektor bosqichi (protocol 12) — eski «instituti Ilmiy kengashining» matni o'zgarmaydi", () => {
    const txt = buildAutoApprovalInfo(fixture({ approvalSteps: LEGACY_APPROVED }));
    expect(txt).toBe(
      PREFIX +
        "Farg'ona jamoat salomatligi tibbiyot instituti Ilmiy kengashining " +
        "2026-yil 15-sentabrdagi 12-sonli bayonnomasi bilan ma'qullangan.",
    );
  });

  test("SHART #3: dean protocol'siz bo'lsa — matn methodical (9) bayonnomasiga tushadi (eskicha qidiruv)", () => {
    const steps = B1_APPROVED.map((s) =>
      s.step === "dean" ? { ...s, protocol: null } : s,
    );
    const txt = buildAutoApprovalInfo(fixture({ approvalSteps: steps }));
    expect(txt).toMatch(
      /instituti Ilmiy kengashining 2026-yil 4-sentabrdagi 9-sonli/,
    );
  });

  test("fakultet nomi topilmasa — bo'sh chiziq bilan «____ fakulteti Kengashining»", () => {
    const txt = buildAutoApprovalInfo(
      fixture({ approvalSteps: B1_APPROVED, directions: [] }),
    );
    expect(txt).toContain("____________________ fakulteti Kengashining");
  });

  test("hech qanday approved+protocol bosqich yo'q — null", () => {
    expect(buildAutoApprovalInfo(fixture({ approvalSteps: [] }))).toBeNull();
  });
});
