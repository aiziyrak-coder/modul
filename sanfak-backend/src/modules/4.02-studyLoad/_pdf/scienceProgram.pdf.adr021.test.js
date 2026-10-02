"use strict";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
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
  barcode: null,
  verify: null,
  ...overrides,
});

const build = (overrides) => {
  ScienceProgram.findById = jest.fn().mockReturnValue(chainablePopulate(fixture(overrides)));
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

beforeEach(() => jest.clearAllMocks());

describe("QR shartli (ADR-021 Qaror #2) — `verify` maydoni WP-B Faza 2 dan bor", () => {
  const render = async (overrides) => {
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    try {
      const doc = await build(overrides);
      await docToBuffer(doc);
      return imageSpy.mock.calls.length;
    } finally {
      imageSpy.mockRestore();
    }
  };

  test("in_review, verify yo'q — QR chizilmaydi", async () => {
    const count = await render({ status: "in_review", verify: null });
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
      verify: { token: "d".repeat(32), revokedAt: null, snapshot: [] },
      approvalSteps: [
        {
          step: "rektor",
          status: "approved",
          approvedBy: { firstName: "R.", lastName: "Karimov" },
          date: new Date(),
        },
      ],
    });
    expect(count).toBe(1);
    delete process.env.PUBLIC_BASE_URL;
  });
});

describe("QR joylashuvi — ZARVARAQ (1-sahifa), oxirgi sahifa EMAS", () => {
  test("QR ikkinchi `addPage()`dan OLDIN chiziladi (ya'ni 1-sahifada, endi TASDIQLAYMAN slotidagi rasm)", async () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz";
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    const addPageSpy = jest.spyOn(PDFDocument.prototype, "addPage");

    const doc = await build({
      status: "approved",
      verify: { token: "f".repeat(32), revokedAt: null, snapshot: [] },
      approvalSteps: [
        {
          step: "rektor",
          status: "approved",
          approvedBy: { firstName: "R.", lastName: "Karimov" },
          date: new Date(),
        },
      ],
    });
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

  test("verify yo'q hujjatda 0 rasm VA cityYear qatori o'z joyida (M, PH-M-35)", async () => {
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    const doc = await build({ status: "approved", verify: null });
    await docToBuffer(doc);
    const cityYearCall = textSpy.mock.calls.find(
      (c) =>
        typeof c[0] === "string" && c[0].includes("FARG'ONA") && /–.*YIL$/.test(c[0]),
    );
    textSpy.mockRestore();
    expect(imageSpy.mock.calls.length).toBe(0);
    imageSpy.mockRestore();
    expect(cityYearCall).toBeDefined();
    expect(cityYearCall[1]).toBe(50);
    expect(cityYearCall[2]).toBe(842 - 50 - 35);
  });
});

describe("Fail-closed — PUBLIC_BASE_URL yo'q + prod (ADR-020 SHART #1, prepareVerifyQr)", () => {
  test("prod + PUBLIC_BASE_URL yo'q — QR chizilmaydi (fail-closed), real imzo bo'lsa ham", async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.PUBLIC_BASE_URL;
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    const doc = await build({
      status: "approved",
      verify: { token: "9".repeat(32), revokedAt: null, snapshot: [] },
      approvalSteps: [
        {
          step: "rektor",
          status: "approved",
          approvedBy: { firstName: "R.", lastName: "Karimov" },
          date: new Date(),
        },
      ],
    });
    await docToBuffer(doc);
    process.env.NODE_ENV = prevEnv;
    expect(imageSpy.mock.calls.length).toBe(0);
    imageSpy.mockRestore();
  });
});

describe("code128 shtrix-kod OLIB TASHLANDI — `barcode` maydoni endi PDF'ga ta'sir qilmaydi", () => {
  test("barcode maydoni BOR, approved, verify.token YO'Q — hech qanday rasm chizilmaydi", async () => {
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    const doc = await build({ status: "approved", barcode: "1234567890128", verify: null });
    await docToBuffer(doc);
    expect(imageSpy.mock.calls.length).toBe(0);
    imageSpy.mockRestore();
  });

  test("barcode maydoni BOR, approved + token BOR — aynan 1 rasm (QR, TASDIQLAYMAN slotida), shtrix-kod EMAS", async () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz";
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    const doc = await build({
      status: "approved",
      barcode: "1234567890128",
      verify: { token: "a".repeat(32), revokedAt: null, snapshot: [] },
      approvalSteps: [
        {
          step: "rektor",
          status: "approved",
          approvedBy: { firstName: "R.", lastName: "Karimov" },
          date: new Date(),
        },
      ],
    });
    await docToBuffer(doc);
    expect(imageSpy.mock.calls.length).toBe(1);
    imageSpy.mockRestore();
    delete process.env.PUBLIC_BASE_URL;
  });

  test("`barcode` qiymati BOR va YO'Q — verify yo'q holatda AYNAN bir xil bayt (barcode endi ta'sirsiz)", async () => {
    const withBarcode = await docToBuffer(
      await build({ status: "approved", barcode: "1234567890128", verify: null }),
    );
    const withoutBarcode = await docToBuffer(
      await build({ status: "approved", barcode: null, verify: null }),
    );
    expect(normalize(withBarcode)).toBe(normalize(withoutBarcode));
  });
});

describe("TASDIQLAYMAN bloki — Times New Roman shrifti (drawSignatureBlock `fonts` opsiyasi)", () => {
  test("v259 blok TNR/TNR-B bilan chiziladi, Helvetica bilan EMAS", async () => {
    const fontSpy = jest.spyOn(PDFDocument.prototype, "font");
    const doc = await build({
      formVersion: "v259",
      confirmation: {},
      approvalSteps: [
        {
          step: "rektor",
          status: "approved",
          approvedBy: { firstName: "R.", lastName: "Karimov" },
          date: new Date(2026, 8, 3),
        },
      ],
    });
    await docToBuffer(doc);
    const fontNames = fontSpy.mock.calls.map((c) => c[0]);
    fontSpy.mockRestore();

    expect(fontNames).toContain("TNR-B");
    expect(fontNames).toContain("TNR");
    expect(fontNames).not.toContain("Helvetica-Bold");
  });

  test("v142 (dekan) bloki ham TNR bilan chiziladi", async () => {
    const fontSpy = jest.spyOn(PDFDocument.prototype, "font");
    const doc = await build({
      formVersion: "v142",
      directions: [{ faculty: { title: "Davolash fakulteti" } }],
      approvalSteps: [
        {
          step: "dean",
          status: "approved",
          approvedBy: { firstName: "F.", lastName: "Raxmatullayev" },
          date: new Date(2026, 7, 28),
        },
      ],
    });
    await docToBuffer(doc);
    const fontNames = fontSpy.mock.calls.map((c) => c[0]);
    fontSpy.mockRestore();

    expect(fontNames).toContain("TNR-B");
    expect(fontNames).not.toContain("Helvetica-Bold");
  });
});
