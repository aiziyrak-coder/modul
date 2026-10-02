"use strict";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const { buildSyllabusPdf } = require("./syllabus.pdf");

const chainable = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const fixture = (overrides = {}) => ({
  _id: "syl1",
  label: null,
  title: null,
  createdAt: new Date("2026-08-19T05:25:57.414Z"),
  confirmation: { confirm: null, position: null, viceRector: null, date: null },
  science: { title: "Mehnat gigiyenasi", scienceCode: "FA1003", department: { title: "Kafedra" } },
  scienceTitle: null,
  scienceType: null,
  scienceCode: null,
  faculty: { title: "Tibbiy profilaktika fakulteti" },
  directions: [],
  year: 0,
  semester: 1,
  credits: 0,
  educationForm: null,
  evaluationForm: null,
  scienceLang: null,
  hoursByType: { title: null, totalHours: 0, items: [] },
  sciencePurpose: { title: null, desc: null },
  prerequisiteKnowledge: { title: null, desc: null },
  learningOutcome: { knowledgeOutcomes: [], skillOutcomes: [] },
  scienceContent: { title: null, desc: null, topics: [] },
  trainingSeminar: { title: null, topics: [] },
  independent: { title: null, topics: [] },
  literatureGroups: [],
  evaluationCriteria: { title: null, criteria: [] },
  author: { teacher: null, email: null, organization: null, reviewer: {} },
  desc: null,
  weeklySchedule: { title: null, weeks: [] },
  submissionRules: { title: null, desc: null },
  contactInfo: {},
  methodicalHead: {},
  facultyDean: {},
  departmentHead: {},
  creator: {},
  approvalSteps: [{ step: "kafedra", status: "pending", approvedBy: null }],
  status: "draft",
  location: null,
  verify: null,
  ...overrides,
});

const build = (doc) => {
  Syllabus.findById = jest.fn().mockReturnValue(chainable(doc));
  return buildSyllabusPdf("syl1");
};

const docToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

beforeEach(() => jest.clearAllMocks());

describe("chiziq CHIZILMAYDI (ADR-021 Qaror #1) — imzo bloklari", () => {
  test("`moveTo`/`lineTo` faqat footer chizig'i uchun chaqiriladi (imzo bloklarida yo'q)", async () => {
    const moveSpy = jest.spyOn(PDFDocument.prototype, "moveTo");
    const lineSpy = jest.spyOn(PDFDocument.prototype, "lineTo");
    const doc = await build(
      fixture({
        approvalSteps: [
          { step: "kafedra", status: "approved", approvedBy: { lastName: "Yoldoshev", firstName: "O." }, date: new Date() },
          { step: "prorektor", status: "approved", approvedBy: { lastName: "Boltaboyev", firstName: "U." }, date: new Date() },
        ],
      }),
    );
    await docToBuffer(doc);
    const moveCalls = moveSpy.mock.calls.length;
    const lineCalls = lineSpy.mock.calls.length;
    moveSpy.mockRestore();
    lineSpy.mockRestore();

    expect(moveCalls).toBeGreaterThan(0);
    expect(moveCalls).toBe(lineCalls);
  });

  test("pastki 4 imzo katagining '___________________________' placeholder'i umuman chizilmaydi", async () => {
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await build(fixture());
    await docToBuffer(doc);
    const texts = spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
    spy.mockRestore();
    expect(texts).not.toContain("___________________________");
  });
});

describe("QR shartli (ADR-021 Qaror #2) — `verify` maydoni WP-B Faza 2 dan bor", () => {
  const render = async (overrides) => {
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    try {
      const doc = await build(fixture(overrides));
      await docToBuffer(doc);
      return imageSpy.mock.calls.length;
    } finally {
      imageSpy.mockRestore();
    }
  };

  test("draft, verify yo'q — QR chizilmaydi", async () => {
    const count = await render({ status: "draft", verify: null });
    expect(count).toBe(0);
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("approved, lekin verify.token yo'q — QR chizilmaydi (hali issueToken chaqirilmagan)", async () => {
    const count = await render({ status: "approved", verify: null });
    expect(count).toBe(0);
  });

  test("approved + token BOR (real issueToken natijasi, WP-B Faza 2) — QR chiziladi (TASDIQLAYMAN slotida)", async () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz";
    const count = await render({
      status: "approved",
      verify: { token: "c".repeat(32), revokedAt: null, snapshot: [] },
      approvalSteps: [
        {
          step: "prorektor",
          status: "approved",
          approvedBy: { firstName: "Ulugbek", lastName: "Boltaboyev" },
          date: new Date(),
        },
      ],
    });
    expect(count).toBe(1);
    delete process.env.PUBLIC_BASE_URL;
  });

  test("to'liq zanjir approved (O'UB/dekan/kafedra/prorektor) + qo'lda «Tuzuvchi» — AYNAN 4 QR (muqova + 3 qator), Tuzuvchi qatorida QR YO'Q", async () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz";
    const approved = (step, firstName, lastName) => ({
      step,
      status: "approved",
      approvedBy: { firstName, lastName },
      date: new Date(),
    });
    const count = await render({
      status: "approved",
      verify: { token: "d".repeat(32), revokedAt: null, snapshot: [] },
      approvalSteps: [
        approved("kafedra", "Nodir", "Mudirov"),
        approved("methodical", "Nilufar", "Rahimova"),
        approved("dean", "Dilshod", "Rahmonov"),
        approved("prorektor", "Ulugbek", "Boltaboyev"),
      ],
      author: { teacher: { firstName: "Anvar", lastName: "Anatomov" }, email: null, organization: null, reviewer: {} },
    });
    expect(count).toBe(4);
    delete process.env.PUBLIC_BASE_URL;
  });

  test("prod + PUBLIC_BASE_URL YO'Q — to'liq zanjirda ham 0 rasm, toBuffer chaqirilmaydi (fail-closed)", async () => {
    delete process.env.PUBLIC_BASE_URL;
    process.env.NODE_ENV = "production";
    const approved = (step, firstName, lastName) => ({
      step,
      status: "approved",
      approvedBy: { firstName, lastName },
      date: new Date(),
    });
    try {
      const count = await render({
        status: "approved",
        verify: { token: "e".repeat(32), revokedAt: null, snapshot: [] },
        approvalSteps: [
          approved("kafedra", "Nodir", "Mudirov"),
          approved("methodical", "Nilufar", "Rahimova"),
          approved("dean", "Dilshod", "Rahmonov"),
          approved("prorektor", "Ulugbek", "Boltaboyev"),
        ],
      });
      expect(count).toBe(0);
      expect(QRCode.toBuffer).not.toHaveBeenCalled();
    } finally {
      delete process.env.NODE_ENV;
    }
  });
});

const normalize = (buf) =>
  buf
    .toString("latin1")
    .replace(/\(D:\d{14}Z?\)/g, "(D:00000000000000Z)")
    .replace(/\/ID \[<[0-9a-f]+> <[0-9a-f]+>\]/g, "/ID [<0> <0>]");

describe("QR imzo slotida — zarvaraq TASDIQLAYMAN bloki (ADR-021 Yangilanish 2026-09-15)", () => {
  test("QR ikkinchi `addPage()`dan OLDIN chiziladi (ya'ni 1-sahifada, endi muqova slotidagi rasm)", async () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz";
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    const addPageSpy = jest.spyOn(PDFDocument.prototype, "addPage");

    const doc = await build(
      fixture({
        status: "approved",
        verify: { token: "f".repeat(32), revokedAt: null, snapshot: [] },
        approvalSteps: [
          {
            step: "prorektor",
            status: "approved",
            approvedBy: { firstName: "Ulugbek", lastName: "Boltaboyev" },
            date: new Date(),
          },
        ],
      }),
    );
    await docToBuffer(doc);

    const firstImageOrder = imageSpy.mock.invocationCallOrder[0];
    const coverToContentAddPageOrder = addPageSpy.mock.invocationCallOrder[1];
    imageSpy.mockRestore();
    addPageSpy.mockRestore();
    delete process.env.PUBLIC_BASE_URL;

    expect(firstImageOrder).toBeDefined();
    expect(coverToContentAddPageOrder).toBeDefined();
    expect(firstImageOrder).toBeLessThan(coverToContentAddPageOrder);
  });

  test("imzolanmagan (status=draft) hujjat — `verify` shakli farq qilsa ham AYNAN bir xil bayt", async () => {
    const withNullVerify = await docToBuffer(
      await build(fixture({ status: "draft", verify: null })),
    );
    const withEmptyVerify = await docToBuffer(
      await build(
        fixture({ status: "draft", verify: { token: null, revokedAt: null, snapshot: [] } }),
      ),
    );
    expect(normalize(withNullVerify)).toBe(normalize(withEmptyVerify));
  });
});

describe("Pastki 4 imzo qatori — ustma-ust emas (ADR-021 Yangilanish 2026-09-15: 2×2 panjara → row)", () => {
  test("har qator y oldingi qatordan katta (O'UB → dekan → kafedra mudiri → Tuzuvchi)", async () => {
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await build(
      fixture({
        approvalSteps: [
          {
            step: "methodical",
            status: "approved",
            approvedBy: { firstName: "Nodira", lastName: "Yusupova" },
            date: new Date("2026-08-20T00:00:00.000Z"),
          },
          { step: "dean", status: "pending", approvedBy: null, date: null },
        ],
      }),
    );
    await docToBuffer(doc);
    const calls = textSpy.mock.calls;
    textSpy.mockRestore();

    const yOf = (label) => {
      const call = calls.find((c) => c[0] === label);
      return call ? call[2] : undefined;
    };
    const yMh = yOf("O'quv-uslubiy boshqarma boshlig'i:");
    const yDean = yOf("Fakultet dekani:");
    const yKafedra = yOf("Kafedra mudiri:");
    const yCreator = yOf("Tuzuvchi:");

    expect(yMh).toBeDefined();
    expect(yDean).toBeDefined();
    expect(yKafedra).toBeDefined();
    expect(yCreator).toBeDefined();
    expect(yDean).toBeGreaterThan(yMh);
    expect(yKafedra).toBeGreaterThan(yDean);
    expect(yCreator).toBeGreaterThan(yKafedra);
  });
});
