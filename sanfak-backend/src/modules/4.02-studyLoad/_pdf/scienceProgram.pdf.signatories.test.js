const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const { buildScienceProgramPdf } = require("./scienceProgram.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const fixture = (overrides = {}) => ({
  title: null,
  formVersion: "v259",
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

describe("v259 zarvaraq — rektor bloki ADR-019 zanjirdan avto-to'ldirish", () => {
  test("`rektor` bosqichi approved bo'lsa — ism va sana chiziladi (qo'lda blok bo'sh)", async () => {
    const t = await withTextSpy(() =>
      build({
        approvalSteps: [
          {
            step: "rektor",
            status: "approved",
            approvedBy: { firstName: "Ulug'bek", lastName: "Boltaboyev" },
            date: new Date(2026, 8, 3),
          },
        ],
      }),
    );
    expect(t.some((s) => s.includes("U.Boltaboyev"))).toBe(true);
    expect(t).toContain('2026-yil " 3 " sentabr');
  });

  test("`rektor` bosqichi pending bo'lsa — shablon sana chiziladi, ism yo'q", async () => {
    const t = await withTextSpy(() =>
      build({
        approvalSteps: [
          { step: "rektor", status: "pending", approvedBy: null, date: null },
        ],
      }),
    );
    expect(t.some((s) => s.includes("Boltaboyev"))).toBe(false);
    expect(t).toContain('202__ yil "___" ________');
  });

  test("qo'lda blok (`confirmation.rector`) to'ldirilgan bo'lsa — zanjirdan ustun turadi", async () => {
    const t = await withTextSpy(() =>
      build({
        confirmation: {
          rector: { firstName: "Anvar", lastName: "Qosimov" },
        },
        approvalSteps: [
          {
            step: "rektor",
            status: "approved",
            approvedBy: { firstName: "Boshqa", lastName: "Odam" },
            date: new Date(),
          },
        ],
      }),
    );
    expect(t.some((s) => s.includes("A.Qosimov"))).toBe(true);
    expect(t.some((s) => s.includes("Odam Boshqa"))).toBe(false);
  });

  test("populate qilinmagan xom ObjectId (`confirmation.rector`) — hech qachon chizilmaydi", async () => {
    const rawId = { toString: () => "6a7d69082200e50d919e2b3a" };
    const t = await withTextSpy(() =>
      build({
        confirmation: { rector: rawId },
        approvalSteps: [],
      }),
    );
    const leaked = t.some((s) => s.includes("6a7d69082200e50d919e2b3a"));
    expect(leaked).toBe(false);
  });
});

describe("v259 zarvaraq — TASDIQLAYMAN lavozim matni (N-05b)", () => {
  test("`confirmation.position` bo'sh bo'lsa — to'liq lavozim matni chiziladi (\"rektor\" o'rniga)", async () => {
    const t = await withTextSpy(() => build({ confirmation: {} }));
    expect(t).toContain("Farg'ona jamoat salomatligi tibbiyot instituti rektori");
    expect(t).not.toContain("rektor");
  });

  test("`confirmation.position` to'ldirilgan bo'lsa — DB qiymati ustun turadi", async () => {
    const t = await withTextSpy(() =>
      build({ confirmation: { position: "Bosh murabbiy" } }),
    );
    expect(t).toContain("Bosh murabbiy");
  });
});
