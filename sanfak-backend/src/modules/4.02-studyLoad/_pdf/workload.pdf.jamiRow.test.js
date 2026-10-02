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

const block = (title, section, totalHour) => ({
  section,
  science: { title },
  course: 1,
  student: 25,
  totalHour,
  studyWork: {
    group: 1,
    stream: 1,
    semester: 1,
    thisSemester: { totalHour, auditoriumHour: totalHour },
  },
  otherWork: {},
});

const wlFixture = (directions) => ({
  _id: new mongoose.Types.ObjectId(),
  title: null,
  agreed: {},
  confirmation: {},
  department: { title: "Ichki kasalliklar kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  directions,
  staffPositions: null,
  methodicalHead: null,
  financialHead: null,
  approvalSteps: [],
  verify: null,
});

const SCIENCE_COL_X = 18 + 1;

const render = async (directions) => {
  WorkloadModel.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(wlFixture(directions)));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    const calls = spy.mock.calls.filter((c) => typeof c[0] === "string");
    return {
      all: calls.map((c) => c[0]),
      firstCol: calls.filter((c) => c[1] === SCIENCE_COL_X).map((c) => c[0]),
    };
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawMainTable — 'Jami' qatorlari takrorlanmaydi (A1)", () => {
  test("1 yo'nalish + 1 bo'lim: FAQAT umumiy 'Jami:' chiziladi (bo'lim jami YO'Q)", async () => {
    const { firstCol } = await render([
      {
        direction: {
          _id: new mongoose.Types.ObjectId(),
          title: "Davolash ishi",
        },
        blocks: [
          block("Ichki kasalliklar", "Majburiy fanlar", 120),
          block("Kardiologiya", "Majburiy fanlar", 80),
        ],
      },
    ]);

    expect(firstCol.filter((s) => s === "Jami")).toHaveLength(0);
    expect(firstCol.filter((s) => s === "Jami:")).toHaveLength(1);
  });

  test("2 guruh (bir yo'nalish, ikki bo'lim): 2 ta bo'lim 'Jami' + 1 ta umumiy 'Jami:'", async () => {
    const { firstCol } = await render([
      {
        direction: {
          _id: new mongoose.Types.ObjectId(),
          title: "Davolash ishi",
        },
        blocks: [
          block("Ichki kasalliklar", "Majburiy fanlar", 120),
          block("Gerontologiya", "Tanlov fanlari", 60),
        ],
      },
    ]);

    expect(firstCol.filter((s) => s === "Jami")).toHaveLength(2);
    expect(firstCol.filter((s) => s === "Jami:")).toHaveLength(1);
  });

  test("2 yo'nalish (har birida 1 bo'lim): 2 ta bo'lim 'Jami' + 1 ta umumiy 'Jami:'", async () => {
    const { firstCol } = await render([
      {
        direction: {
          _id: new mongoose.Types.ObjectId(),
          title: "Davolash ishi",
        },
        blocks: [block("Ichki kasalliklar", "Majburiy fanlar", 120)],
      },
      {
        direction: {
          _id: new mongoose.Types.ObjectId(),
          title: "Stomatologiya",
        },
        blocks: [block("Terapevtik stomatologiya", "Majburiy fanlar", 90)],
      },
    ]);

    expect(firstCol.filter((s) => s === "Jami")).toHaveLength(2);
    expect(firstCol.filter((s) => s === "Jami:")).toHaveLength(1);
  });

  test("yagona guruhda umumiy 'Jami:' qatori soatlarni YO'QOTMAYDI (120+80=200)", async () => {
    const { all } = await render([
      {
        direction: {
          _id: new mongoose.Types.ObjectId(),
          title: "Davolash ishi",
        },
        blocks: [
          block("Ichki kasalliklar", "Majburiy fanlar", 120),
          block("Kardiologiya", "Majburiy fanlar", 80),
        ],
      },
    ]);

    expect(all).toContain("200");
  });
});
