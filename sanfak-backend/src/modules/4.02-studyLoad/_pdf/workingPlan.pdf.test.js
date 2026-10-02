const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const simpleFind = (resolvedDoc) => ({
  exec: jest.fn().mockResolvedValue(resolvedDoc),
});

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const WS_ID = new mongoose.Types.ObjectId();

const wpFixture = () => ({
  workingSchedule: WS_ID,
  semesters: null,
  studyPlanLabel: null,
});

const wsFixture = (academicYear) => ({
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear,
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
});

beforeEach(() => {
  jest.clearAllMocks();
  WorkingPlanModel.findById = jest.fn().mockReturnValue(simpleFind(wpFixture()));
});

describe("buildWorkingRejaDoc — academicYear ObjectId ref (D-094 regressiya)", () => {
  test("populate qilingan { title } bo'lsa — PDF xatosiz quriladi", async () => {
    WorkingScheduleModel.findById = jest
      .fn()
      .mockReturnValue(
        chainablePopulate(
          wsFixture({ _id: new mongoose.Types.ObjectId(), title: "2025/2026" }),
        ),
      );

    const doc = await buildWorkingRejaDoc("wpId1");
    expect(() => doc.end()).not.toThrow();
  });

  test("populate qilinmagan xom ObjectId bo'lsa — xato otilmaydi va PDF matnida hex chiqmaydi", async () => {
    const rawId = new mongoose.Types.ObjectId();
    WorkingScheduleModel.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(wsFixture(rawId)));

    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const doc = await buildWorkingRejaDoc("wpId2");
    doc.end();

    const leaked = textSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes(rawId.toString()),
    );
    expect(leaked).toBe(false);
    textSpy.mockRestore();
  });

  test("academicYear null bo'lsa ham xatosiz quriladi", async () => {
    WorkingScheduleModel.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(wsFixture(null)));

    await expect(buildWorkingRejaDoc("wpId3")).resolves.toBeDefined();
  });

  test("workingSchedule query zanjiriga `academicYear` populate qo'shilgan", async () => {
    const chain = chainablePopulate(wsFixture(null));
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain);

    await buildWorkingRejaDoc("wpId4");

    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
  });
});
