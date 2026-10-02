"use strict";

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#references/position/position.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const Position = require("#references/position/position.model");
const { buildWorkloadPdf } = require("./workload.pdf");
const { buildDistributionPdf } = require("./distribution.pdf");
const { docToBuffer, extractPdfLines } = require("./staffHeaderText.testutil");

const NEW_LABEL = "Stajyor o'qituvchi";
const RETIRED_LABEL = "Amaliyotchi (stajyor) o'qituvchi";
const FIXED_LABEL = "Assistent o'qituvchi";
const OLD_LABEL = "Assistent. O'qtuvchi";

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const staffPositions = {
  items: [
    { category: "teachingStaff", slug: "professor", positions: 2, load: 300, totalHours: 600 },
    { category: "teachingStaff", slug: "docent", positions: 3, load: 350, totalHours: 1050 },
    { category: "teachingStaff", slug: "assistant", positions: 4, load: 400, totalHours: 1600 },
  ],
  totalPositions: 9,
  hourly: 0,
};

const wlFixture = () => ({
  _id: new mongoose.Types.ObjectId(),
  title: null,
  agreed: {},
  confirmation: {},
  department: { title: "Stomatologiya kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  directions: [],
  approvalSteps: [],
  staffPositions,
  methodicalHead: null,
  financialHead: null,
  verify: null,
});

const distFixture = () => ({
  title: null,
  confirmation: {},
  department: { title: "Stomatologiya kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  teachers: [],
  staffPositions,
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
});

const renderWorkloadCalls = async () => {
  WorkloadModel.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(wlFixture()));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

const renderDistributionCalls = async () => {
  WorkloadDistribution.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(distFixture()));
  Position.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildDistributionPdf("dist1");
    doc.end();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workload.pdf — kadrlar jadvali ustunlari (A8-PDF)", () => {
  test("yangi ustun + tuzatilgan yorliq chiziladi, eskisi YO'Q", async () => {
    const t = await renderWorkloadCalls();
    expect(t).toContain(NEW_LABEL);
    expect(t).toContain(FIXED_LABEL);
    expect(t).not.toContain(OLD_LABEL);
    expect(t).not.toContain(RETIRED_LABEL);
    expect(t.some((s) => /amaliyotchi/i.test(s))).toBe(false);
  });

  test("guruh jami ('Jami ish o'rni') `cols` bo'ylab yig'iladi — yangi ustun ham kiradi", async () => {
    const t = await renderWorkloadCalls();
    expect(t).toContain("9");
    expect(t).toContain("361");
    expect(t).not.toContain("361.1");
    expect(t).toContain("3250");
  });
});

describe("distribution.pdf — kadrlar jadvali ustunlari (A8-PDF)", () => {
  test("yangi ustun + tuzatilgan yorliq chiziladi, eskisi YO'Q", async () => {
    const t = await renderDistributionCalls();
    expect(t).toContain(NEW_LABEL);
    expect(t).toContain(FIXED_LABEL);
    expect(t).not.toContain(OLD_LABEL);
  });
});

describe("sarlavha matni PDF'da TO'LIQ chiqadi (T0 — kesilmaydi)", () => {
  let lines;

  beforeAll(async () => {
    WorkloadModel.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(wlFixture()));
    const buf = await docToBuffer(await buildWorkloadPdf("wl1"));
    lines = extractPdfLines(buf);
  });

  test("ekstraktor ishlayapti — jadval yorliqlari o'qildi", () => {
    expect(lines.length).toBeGreaterThan(20);
    expect(lines).toContain("Kafedra mudiri");
  });

  test("yangi yorliq PDF'da TO'LIQ chizilgan (bir qatorda yoki so'z bo'yicha o'ralib)", () => {
    const joined = lines.join(" ").replace(/\s+/g, " ");
    expect(joined).toContain(NEW_LABEL);
    const trimmed = lines.map((l) => l.trim());
    const oneLine = trimmed.includes(NEW_LABEL);
    const wrapped = trimmed.includes("Stajyor") && trimmed.includes("o'qituvchi");
    expect(oneLine || wrapped).toBe(true);
  });

  test("hech bir qatorda ellipsis (`…` yoki `...`) yo'q", () => {
    expect(lines.filter((l) => l.includes("…"))).toEqual([]);
    expect(lines.filter((l) => l.includes("..."))).toEqual([]);
  });

  test("tuzatilgan yorliq PDF'da bir qatorda to'liq turibdi", () => {
    expect(lines).toContain(FIXED_LABEL);
    expect(lines.join(" ")).not.toContain(OLD_LABEL);
  });
});

describe("distribution.pdf — sarlavha matni PDF'da TO'LIQ chiqadi (T0)", () => {
  let lines;

  beforeAll(async () => {
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(distFixture()));
    Position.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    const buf = await docToBuffer(await buildDistributionPdf("dist1"));
    lines = extractPdfLines(buf);
  });

  test("yangi yorliq TO'LIQ (katak balandligi H2=14 da ham kesilmaydi)", () => {
    const joined = lines.join(" ").replace(/\s+/g, " ");
    expect(joined).toContain(NEW_LABEL);
    expect(joined).toContain(FIXED_LABEL);
  });

  test("hech bir qatorda ellipsis yo'q", () => {
    expect(lines.filter((l) => l.includes("…"))).toEqual([]);
  });
});
