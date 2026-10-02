const mongoose = require("mongoose");

jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const { buildScienceProgramPdf } = require("./scienceProgram.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const baseFixture = (academicYear) => ({
  title: null,
  confirmation: {},
  science: { name: "Ichki kasalliklar propedevtikasi" },
  label: null,
  directions: [],
  knowledgeArea: [],
  educationArea: [],
  code: "SP-01",
  academicYear,
  semester: "1",
  credits: 5,
  moduleType: "majburiy",
  language: "uz",
  weeklyHours: 4,
  hourItems: [],
  classroomHours: 30,
  independentHours: 20,
  totalHours: 50,
  scienceEssence: null,
  theoretical: null,
  seminarRecommendation: null,
  independentTask: null,
  learningOutcome: null,
  teachingMethods: null,
  creditRequirements: null,
  literatureGroups: [],
  guidanceLiterature: null,
  primaryLiterature: null,
  additionalLiterature: null,
  informationSource: null,
  approval_info: null,
  responsible: null,
  reviewer: null,
  approvalSteps: [],
  barcode: null,
  status: "draft",
  location: null,
  city: null,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildScienceProgramPdf — academicYear ObjectId ref (D-094 regressiya)", () => {
  test("populate qilingan { title } bo'lsa — PDF xatosiz quriladi", async () => {
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue(
        chainablePopulate(
          baseFixture({ _id: new mongoose.Types.ObjectId(), title: "2025/2026" }),
        ),
      );

    const doc = await buildScienceProgramPdf("spId1");
    expect(() => doc.end()).not.toThrow();
  });

  test("populate qilinmagan xom ObjectId bo'lsa — `.split is not a function` otilmaydi", async () => {
    const rawId = new mongoose.Types.ObjectId();
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(baseFixture(rawId)));

    await expect(buildScienceProgramPdf("spId2")).resolves.toBeDefined();
  });

  test("academicYear null bo'lsa ham xatosiz quriladi", async () => {
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(baseFixture(null)));

    await expect(buildScienceProgramPdf("spId3")).resolves.toBeDefined();
  });

  test("query zanjiriga `academicYear` populate qo'shilgan", async () => {
    const chain = chainablePopulate(baseFixture(null));
    ScienceProgram.findById = jest.fn().mockReturnValue(chain);

    await buildScienceProgramPdf("spId4");

    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
  });
});
