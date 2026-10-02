"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
jest.mock("./scienceProgramV142.pdf", () => ({
  buildScienceProgramV142Pdf: jest.fn(),
}));

const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const { buildScienceProgramV142Pdf } = require("./scienceProgramV142.pdf");
const {
  buildScienceProgramPdf,
  loadScienceProgramForPdf,
} = require("./scienceProgram.pdf");

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
  barcode: null,
  verify: null,
  ...overrides,
});

const FAKE_DOC = { fake: "v142-doc" };

let chain;
const arrange = (doc) => {
  chain = chainablePopulate(doc);
  ScienceProgram.findById = jest.fn().mockReturnValue(chain);
};

const drain = (doc) =>
  new Promise((resolve) => {
    doc.on("end", resolve);
    doc.resume();
    doc.end();
  });

beforeEach(() => {
  jest.clearAllMocks();
  buildScienceProgramV142Pdf.mockResolvedValue(FAKE_DOC);
});

describe("buildScienceProgramPdf — formVersion dispatch", () => {
  test("v142 → v142 renderer YUKLANGAN hujjat bilan chaqiriladi, natijasi qaytadi", async () => {
    const doc = fixture({ formVersion: "v142" });
    arrange(doc);
    const out = await buildScienceProgramPdf("sp142");
    expect(buildScienceProgramV142Pdf).toHaveBeenCalledTimes(1);
    expect(buildScienceProgramV142Pdf).toHaveBeenCalledWith(doc);
    expect(out).toBe(FAKE_DOC);
  });

  test("v259 → eski yo'l, renderer CHAQIRILMAYDI, haqiqiy PDFDocument qaytadi", async () => {
    arrange(fixture({ formVersion: "v259" }));
    const out = await buildScienceProgramPdf("sp259");
    expect(buildScienceProgramV142Pdf).not.toHaveBeenCalled();
    expect(typeof out.pipe).toBe("function");
    await drain(out);
  });

  test("formVersion YO'Q (legacy) → v259 yo'li (ADR-008 invariant #4 — musbat tekshiruv)", async () => {
    const doc = fixture();
    delete doc.formVersion;
    arrange(doc);
    const out = await buildScienceProgramPdf("spLegacy");
    expect(buildScienceProgramV142Pdf).not.toHaveBeenCalled();
    expect(typeof out.pipe).toBe("function");
    await drain(out);
  });

  test("hujjat topilmasa — «Fan dasturi topilmadi», renderer chaqirilmaydi", async () => {
    arrange(null);
    await expect(buildScienceProgramPdf("yoq")).rejects.toThrow("Fan dasturi topilmadi");
    expect(buildScienceProgramV142Pdf).not.toHaveBeenCalled();
  });
});

describe("loadScienceProgramForPdf — YAGONA populate zanjiri (R-4.02-01)", () => {
  test("eksport qilingan va `findById(id)` + zanjir natijasini qaytaradi", async () => {
    const doc = fixture({ formVersion: "v142" });
    arrange(doc);
    await expect(loadScienceProgramForPdf("id1")).resolves.toBe(doc);
    expect(ScienceProgram.findById).toHaveBeenCalledWith("id1");
  });

  test("`science` populate'i `department` (title) ichki populate bilan — v142 2-beti", async () => {
    arrange(fixture({ formVersion: "v142" }));
    await loadScienceProgramForPdf("id2");
    expect(chain.populate).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "science",
        select: expect.stringContaining("department"),
        populate: expect.objectContaining({ path: "department", select: "title" }),
      }),
    );
  });

  test("mavjud zanjir bo'g'inlari saqlanadi (directions.faculty, approvalSteps.approvedBy, academicYear, confirmation.rector)", async () => {
    arrange(fixture({ formVersion: "v259" }));
    await loadScienceProgramForPdf("id3");
    expect(chain.populate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "directions", populate: expect.objectContaining({ path: "faculty" }) }),
    );
    expect(chain.populate).toHaveBeenCalledWith("approvalSteps.approvedBy", "firstName lastName middleName");
    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
    expect(chain.populate).toHaveBeenCalledWith("confirmation.rector", "firstName lastName middleName");
    expect(chain.populate).toHaveBeenCalledTimes(5);
  });

  test("buildScienceProgramPdf ham AYNAN shu zanjirdan o'qiydi (ikkinchi findById yo'q)", async () => {
    arrange(fixture({ formVersion: "v142" }));
    await buildScienceProgramPdf("id4");
    expect(ScienceProgram.findById).toHaveBeenCalledTimes(1);
    expect(chain.exec).toHaveBeenCalledTimes(1);
  });
});

describe("loadScienceProgramForPdf — directions select'ida soha maydonlari (D-9)", () => {
  test("`directions` select'ida `knowledgeArea` va `educationArea` bor", async () => {
    arrange(fixture({ formVersion: "v259" }));
    await loadScienceProgramForPdf("id5");
    const dirPopulate = chain.populate.mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg && arg.path === "directions");
    const fields = String(dirPopulate && dirPopulate.select).split(/\s+/);
    expect(fields).toEqual(expect.arrayContaining(["knowledgeArea", "educationArea"]));
  });
});

describe("scienceProgramV142.pdf.js — DB'ga murojaat YO'Q (grep-darvoza)", () => {
  const FILES = ["scienceProgramV142.pdf.js", "scienceProgramDean.js", "programAreas.js"];
  const FORBIDDEN = [
    [/\.populate\s*\(/, ".populate("],
    [/\bfindById\b/, "findById"],
    [/\bfindOne\s*\(/, "findOne("],
    [/require\(\s*["'][^"']*\.model["']\s*\)/, "require(...model)"],
    [/require\(\s*["']\.\/scienceProgram\.pdf["']\s*\)/, "require(./scienceProgram.pdf) — sikl"],
  ];

  const codeLines = (file) =>
    fs
      .readFileSync(path.join(__dirname, file), "utf8")
      .split(/\r?\n/)
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line));

  test.each(FILES.flatMap((f) => FORBIDDEN.map(([rx, label]) => [f, label, rx])))(
    "%s — `%s` yo'q",
    (file, _label, rx) => {
      const hits = codeLines(file).filter(({ line }) => rx.test(line));
      expect(hits).toEqual([]);
    },
  );

  test("renderer `loadScienceProgramForPdf` bilan bir xil model yo'lini import qilmaydi", () => {
    const src = fs.readFileSync(path.join(__dirname, "scienceProgramV142.pdf.js"), "utf8");
    expect(src).not.toMatch(/scienceProgram\.model/);
    expect(src).not.toMatch(/mongoose/);
  });
});
