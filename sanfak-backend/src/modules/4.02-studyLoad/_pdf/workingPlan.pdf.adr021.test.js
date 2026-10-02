"use strict";

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const simpleFind = (resolvedDoc) => ({ exec: jest.fn().mockResolvedValue(resolvedDoc) });
const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const wpFixture = () => ({
  workingSchedule: new mongoose.Types.ObjectId(),
  semesters: null,
  studyPlanLabel: null,
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
  WorkingPlanModel.findById = jest.fn().mockReturnValue(simpleFind(wpFixture()));
});

describe("chiziq CHIZILMAYDI (ADR-021 Qaror #1)", () => {
  test("eski qattiq imzo chiziqlari (KELISHILDI/TASDIQLAYMAN/O'UB/dekan) endi chizilmaydi", async () => {
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(chainablePopulate(wsFixture()));
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
    spy.mockRestore();

    expect(texts).not.toContain("__________________");
    expect(texts).not.toContain("____________________");
    expect(texts).not.toContain("________________");
  });

  test("F.I.O bo'lganda ham chiziq chizilmaydi (regressiya)", async () => {
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(
      chainablePopulate(
        wsFixture({
          agreed: { viceRector: { lastName: "Boltaboyev", firstName: "U." } },
          confirmation: { rector: { lastName: "Karimov", firstName: "R." } },
          methodicalHead: { leader: { lastName: "Nodirov", firstName: "A." } },
          facultyDean: { dean: { lastName: "Yusupova", firstName: "N." } },
        }),
      ),
    );
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
    spy.mockRestore();

    expect(texts).not.toContain("__________________");
    expect(texts).not.toContain("____________________");
    expect(texts).not.toContain("________________");
    expect(texts).toContain("U.Boltaboyev");
    expect(texts).toContain("R.Karimov");
  });
});
