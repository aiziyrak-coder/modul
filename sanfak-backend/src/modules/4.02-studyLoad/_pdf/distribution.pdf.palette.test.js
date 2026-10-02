"use strict";

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#references/position/position.model");

const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const Position = require("#references/position/position.model");
const { buildDistributionPdf } = require("./distribution.pdf");

const FORBIDDEN = [
  "#1a3c5e",
  "#2e6da4",
  "#dce8f5",
  "#c8dff0",
  "#f4f7fc",
  "#d6ecd6",
  "#1a3c1a",
  "#90aac8",
  "#a3d9a3",
  "#e6f0fa",
  "#d8eaf8",
];

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const distFixture = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  title: null,
  confirmation: { rector: { lastName: "Boltaboyev", firstName: "U." } },
  department: { title: "Stomatologiya kafedrasi" },
  date: new Date(2026, 8, 1),
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  teachers: [
    {
      position: "docent",
      stavka: 0.5,
      teacher: { lastName: "Karimov", firstName: "A.", middleName: "B." },
      blocks: [
        {
          science: { title: "Terapevtik stomatologiya", scienceCode: "ST01" },
          course: 3,
          student: 40,
          studyWork: {},
          totalHour: 325,
        },
        {
          science: { title: "Ortopedik stomatologiya", scienceCode: "ST02" },
          course: 4,
          student: 30,
          studyWork: {},
          totalHour: 180,
        },
      ],
    },
    {
      isVacant: true,
      vacantLabel: "Vakant 1 st.",
      stavka: 1,
      blocks: [
        {
          science: { title: "Bolalar stomatologiyasi", scienceCode: "ST03" },
          course: 2,
          student: 25,
          studyWork: {},
          totalHour: 250,
        },
      ],
    },
  ],
  staffPositions: { items: [], totalPositions: 0, hourly: 0 },
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
  approvalSteps: [],
  verify: null,
  ...overrides,
});

const mockPositions = () => {
  Position.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([
      { title: "Dotsent", annualHours: 650, date: "2024-01-01" },
      { title: "Assistent", annualHours: 850, date: "2024-01-01" },
    ]),
  });
};

const renderColors = async () => {
  mockPositions();
  WorkloadDistribution.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(distFixture()));

  const fillColorSpy = jest.spyOn(PDFDocument.prototype, "fillColor");
  const strokeColorSpy = jest.spyOn(PDFDocument.prototype, "strokeColor");
  const fillSpy = jest.spyOn(PDFDocument.prototype, "fill");
  try {
    const doc = await buildDistributionPdf("dist1");
    doc.end();
    const flat = (spy) =>
      spy.mock.calls.map((c) => c[0]).filter((v) => typeof v === "string");
    return {
      fillColors: flat(fillColorSpy),
      strokeColors: flat(strokeColorSpy),
      fills: flat(fillSpy),
    };
  } finally {
    fillColorSpy.mockRestore();
    strokeColorSpy.mockRestore();
    fillSpy.mockRestore();
  }
};

describe("distribution.pdf palitrasi — blanka oq-qora (F-49b)", () => {
  let colors;

  beforeAll(async () => {
    jest.clearAllMocks();
    colors = await renderColors();
  });

  test("rang chaqiruvlari umuman yozilgan (spy ishlayapti — yolg'on yashil emas)", () => {
    expect(colors.fillColors.length).toBeGreaterThan(10);
    expect(colors.strokeColors.length).toBeGreaterThan(10);
  });

  test("olib tashlangan ko'k/yashil palitra hech bir rang chaqiruvida yo'q", () => {
    const all = [
      ...colors.fillColors,
      ...colors.strokeColors,
      ...colors.fills,
    ].map((c) => c.toLowerCase());

    for (const hex of FORBIDDEN) {
      expect(all).not.toContain(hex);
    }
  });

  test("jadval kataklarida FON chizilmaydi (`doc.fill(<rang>)` chaqirilmaydi)", () => {
    expect(colors.fills).toEqual([]);
  });

  test("ramka qora (`#000000`) — ko'k ramka emas", () => {
    expect(colors.strokeColors).toContain("#000000");
  });
});
