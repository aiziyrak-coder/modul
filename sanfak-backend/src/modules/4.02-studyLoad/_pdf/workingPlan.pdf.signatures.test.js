"use strict";

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const PDFDocument = require("pdfkit");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const wpFixture = (overrides = {}) => ({
  workingSchedule: "ws1",
  semesters: null,
  studyPlanLabel: null,
  ...overrides,
});

const wsFixture = (overrides = {}) => ({
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { title: "2025/2026" },
  stage: null,
  direction: { title: "Davolash ishi", directionCode: "5510100" },
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
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(wpFixture()),
  });
});

describe("pastki imzo qatorlari — layout:\"row\" (chap lavozim / o'rta holat / o'ng F.I.O)", () => {
  test("lavozim va F.I.O bitta qatorda, lavozim CHAPDA, ism O'NGDA", async () => {
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(
      chainablePopulate(
        wsFixture({
          methodicalHead: {
            position: "O'quv-uslubiy boshqarma boshlig'i",
            leader: { firstName: "Anvar", middleName: "Qodir", lastName: "Nodirov" },
          },
          facultyDean: {
            position: "Fakultet dekani",
            dean: { firstName: "Nodira", lastName: "Yusupova" },
          },
        }),
      ),
    );
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    const calls = spy.mock.calls;
    spy.mockRestore();

    const mhPos = calls.find((c) => c[0] === "O'quv-uslubiy boshqarma boshlig'i");
    const mhName = calls.find((c) => c[0] === "A.Q.Nodirov");
    expect(mhPos).toBeTruthy();
    expect(mhName).toBeTruthy();
    expect(mhName[2]).toBe(mhPos[2]);
    expect(mhPos[1]).toBeLessThan(mhName[1]);

    const fdPos = calls.find((c) => c[0] === "Fakultet dekani");
    const fdName = calls.find((c) => c[0] === "N.Yusupova");
    expect(fdPos).toBeTruthy();
    expect(fdName).toBeTruthy();
    expect(fdName[2]).toBe(fdPos[2]);
    expect(fdPos[1]).toBeLessThan(fdName[1]);
  });

  test("F6 regressiya: bo'sh/populate qilinmagan `person` bilan yolg'iz '.' HECH QACHON chizilmaydi", async () => {
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(
      chainablePopulate(
        wsFixture({
          methodicalHead: { position: "O'quv-uslubiy boshqarma boshlig'i", leader: null },
          facultyDean: { position: "Fakultet dekani", dean: "507f1f77bcf86cd799439099" },
        }),
      ),
    );
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
    spy.mockRestore();

    expect(texts).not.toContain(".");
    expect(texts.some((t) => /^\.\s*$/.test(t))).toBe(false);
  });

  test("holat ustuni chizilmaydi (manual — Kengash #6, ADR-021 Qaror #4)", async () => {
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(
      chainablePopulate(
        wsFixture({
          methodicalHead: {
            position: "O'quv-uslubiy boshqarma boshlig'i",
            leader: { firstName: "Anvar", lastName: "Nodirov" },
          },
        }),
      ),
    );
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]);
    spy.mockRestore();
    expect(texts).not.toContain("Elektron tasdiqlangan");
  });
});

describe("P0-03 — ensureRoom `measureSignatureBlock` orqali (haqiqiy balandlik)", () => {
  const particle = (h, l, p, lab, s, ind) => [
    { canonical: "hour", value: h },
    { canonical: "lecture", value: l },
    { canonical: "practical", value: p },
    { canonical: "laboratory", value: lab },
    { canonical: "seminar", value: s },
    { canonical: "independent", value: ind },
  ];
  const mkSci = (i) => ({
    code: `FA${1000 + i}`,
    title: `Fan nomi ${i} — uzunroq sarlavha misoli`,
    particle: particle(60, 10, 14, 4, 2, 30),
    totalCredit: 2,
    weeklyHours: 2,
    evaluationType: null,
  });
  const denseWpFixture = (n) => {
    const semesters = new Map();
    for (const sem of ["1", "2"]) {
      const sciences = Array.from({ length: n }, (_, i) => mkSci(i + 1));
      const half = Math.ceil(n / 2);
      semesters.set(sem, {
        blocks: [
          { blockCode: "MFI", title: "Majburiy fanlar", sciences: sciences.slice(0, half) },
          { blockCode: "TF2", title: "Tanlov fanlar", sciences: sciences.slice(half) },
        ],
      });
    }
    return { workingSchedule: "ws1", semesters, studyPlanLabel: null };
  };

  const pageCount = (buf) =>
    (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

  test("13 fanli reja + UZUN lavozim/F.I.O bilan imzo qatorlari — bet soni ORTIQCHA OCHILMAYDI (2 bet)", async () => {
    WorkingPlanModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(denseWpFixture(13)),
    });
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(
      chainablePopulate(
        wsFixture({
          direction: { title: "Davolash ishi", directionCode: "5510100" },
          academicLevel: { title: "Bakalavr" },
          educationForm: { title: "Kunduzgi" },
          methodicalHead: {
            position:
              "O'quv-uslubiy boshqarma boshlig'i va uning muassasadagi to'liq mas'uliyati",
            leader: {
              firstName: "Anvarjon",
              middleName: "Qodirjon",
              lastName: "Nodirovabekov",
            },
          },
          facultyDean: {
            position:
              "Fakultet dekani (tibbiyot-profilaktika va davolash yo'nalishi)",
            dean: { firstName: "Nodirabegim", lastName: "Yusupovaxonova" },
          },
        }),
      ),
    );

    const chunks = [];
    const doc = await buildWorkingRejaDoc("wp1");
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", resolve));
    doc.end();
    await done;
    const buf = Buffer.concat(chunks);
    const pages = pageCount(buf);

    expect(pages).toBe(2);
  });
});
