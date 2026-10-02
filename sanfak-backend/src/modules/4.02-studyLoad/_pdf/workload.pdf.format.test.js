"use strict";

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf } = require("./workload.pdf");

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const block = (title, totalHour) => ({
  section: "Majburiy fanlar",
  science: { title },
  course: 5,
  student: 54,
  totalHour,
  studyWork: { group: 4, stream: 1, semester: 9, thisSemester: { totalHour, auditoriumHour: totalHour } },
  otherWork: {},
});

const wlFixture = () => ({
  _id: new mongoose.Types.ObjectId(),
  title: null,
  agreed: {},
  confirmation: {},
  department: { title: "Stomatologiya va otorinolaringologiya kafedrasi" },
  date: "14/12/2025",
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  directions: [
    {
      direction: { _id: new mongoose.Types.ObjectId(), title: "Stomatologiya" },
      blocks: [block("Terapevtik stomatologiya", 12.5), block("Ortopedik stomatologiya", 20)],
    },
  ],
  approvalSteps: [],
  staffPositions: {
    items: [
      { category: "departmentHead", slug: "docent", positions: 0.5, load: 650, totalHours: 325 },
      { category: "teachingStaff", slug: "seniorTeacher", positions: 1, load: 750, totalHours: 750 },
      { category: "teachingStaff", slug: "assistant", positions: 33, load: 850, totalHours: 28176 },
      { category: "supportStaff", slug: "cabinetHead", positions: 1, load: 0, totalHours: 0 },
    ],
    totalPositions: 35,
    hourly: 0,
  },
  methodicalHead: null,
  financialHead: null,
  verify: null,
});

const renderTexts = async () => {
  WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(wlFixture()));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workload.pdf — son va sana blanka kabi", () => {
  test("sarlavhadagi sana: saqlangan '14/12/2025' → '14.12.2025-yil'", async () => {
    const t = await renderTexts();
    expect(t).toContain("14.12.2025-yil");
    expect(t).not.toContain("14/12/2025-yil");
  });

  test("Jadval 2 «Ish o'rinlari»: 0,5 | 1 | 33 | 34,5 | 1 | 35,5", async () => {
    const t = await renderTexts();
    const start = t.lastIndexOf("Ish o'rinlari");
    const row = t.slice(start + 1, t.indexOf("O'quv yuklama", start));
    expect(row).toEqual(["0,5", "1", "33", "34,5", "1", "35,5"]);
  });

  test("Jadval 2 «O'quv yuklama» / «Jami soat» — blanka kabi, oxirgi jami katagi bo'sh", async () => {
    const t = await renderTexts();
    const rowOf = (label, next) => {
      const i = t.lastIndexOf(label);
      return t.slice(i + 1, t.indexOf(next, i + 1));
    };
    expect(rowOf("O'quv yuklama", "Jami soat")).toEqual(["650", "750", "850", "848"]);
    expect(rowOf("Jami soat", "Soatbay")).toEqual(["325", "750", "28176", "29251"]);
  });

  test("asosiy jadval: kasr soat '12,5', umumiy jami '32,5'; nuqtali kasr yo'q", async () => {
    const t = await renderTexts();
    expect(t).toContain("12,5");
    expect(t).toContain("32,5");
    expect(t.filter((s) => /^\d+\.\d+$/.test(s))).toEqual([]);
  });
});
