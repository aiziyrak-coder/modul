const mongoose = require("mongoose");

jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const {
  buildScienceProgramPdf,
  buildDeanConfirmationBlock,
  resolveDeanFacultyName,
} = require("./scienceProgram.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const baseFixture = (overrides = {}) => ({
  title: null,
  confirmation: {},
  science: { name: "Ichki kasalliklar propedevtikasi" },
  label: null,
  directions: [],
  knowledgeArea: [],
  educationArea: [],
  code: "SP-01",
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
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
  status: "in_review",
  location: null,
  city: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveDeanFacultyName", () => {
  test("directions[0].faculty populate qilingan bo'lsa — nomi qaytadi", () => {
    const sp = { directions: [{ faculty: { title: "Neft va gaz fakulteti" } }] };
    expect(resolveDeanFacultyName(sp)).toBe("Neft va gaz fakulteti");
  });

  test("faculty topilmasa — bo'sh string (taxminiy matn YO'Q)", () => {
    expect(resolveDeanFacultyName({ directions: [] })).toBe("");
    expect(resolveDeanFacultyName({ directions: [{ faculty: null }] })).toBe("");
  });
});

describe("buildDeanConfirmationBlock — v142 zarvaraq tasdiqlovchi bloki", () => {
  test("test #2: dean bosqichi approved — F.I.O va sana to'ldirilgan", () => {
    const sp = {
      directions: [{ faculty: { title: "Davolash fakulteti" } }],
      approvalSteps: [
        {
          step: "dean",
          status: "approved",
          approvedBy: { firstName: "Falonchi", lastName: "Raxmatullayev" },
          date: new Date(2026, 7, 28),
        },
      ],
    };
    const block = buildDeanConfirmationBlock(sp);
    expect(block.position).toBe("Davolash fakulteti dekani");
    expect(block.name).toBe("F.Raxmatullayev");
    expect(block.date).toContain("2026-yil");
    expect(block.date).toContain("28");
    expect(block.date).toContain("avgust");
  });

  test("faculty nomi 'fakultet' so'zisiz bo'lsa (buyruq namunasidagi shakl) — qo'shiladi", () => {
    const sp = {
      directions: [{ faculty: { title: "Neft va gaz" } }],
      approvalSteps: [{ step: "dean", status: "pending", approvedBy: null, date: null }],
    };
    expect(buildDeanConfirmationBlock(sp).position).toBe(
      "Neft va gaz fakulteti dekani",
    );
  });

  test("real DB shaklidagi nom ('... fakulteti') — 'fakultet' TAKRORLANMAYDI", () => {
    const sp = {
      directions: [{ faculty: { title: "Davolash ishi fakulteti" } }],
      approvalSteps: [],
    };
    expect(buildDeanConfirmationBlock(sp).position).toBe(
      "Davolash ishi fakulteti dekani",
    );
  });

  test("test #3: dean bosqichi pending — F.I.O/sana bo'sh, yiqilmaydi", () => {
    const sp = {
      directions: [{ faculty: { title: "Davolash fakulteti" } }],
      approvalSteps: [{ step: "dean", status: "pending", approvedBy: null, date: null }],
    };
    expect(() => buildDeanConfirmationBlock(sp)).not.toThrow();
    const block = buildDeanConfirmationBlock(sp);
    expect(block.name).toBe("");
    expect(block.date).not.toContain("2026");
  });

  test("dean bosqichi umuman topilmasa (v142 lekin approvalSteps bo'sh) — yiqilmaydi", () => {
    const sp = { directions: [], approvalSteps: [] };
    expect(() => buildDeanConfirmationBlock(sp)).not.toThrow();
    expect(buildDeanConfirmationBlock(sp).name).toBe("");
  });
});

describe("buildScienceProgramPdf — formVersion tarmoqlanishi", () => {
  test("test #1: formVersion='v259' — xatosiz quriladi (rektor bloki, hozirgidek)", async () => {
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(baseFixture({ formVersion: "v259" })));

    await expect(buildScienceProgramPdf("spV259")).resolves.toBeDefined();
  });

  test("test #2: formVersion='v142', dean approved — xatosiz quriladi", async () => {
    ScienceProgram.findById = jest.fn().mockReturnValue(
      chainablePopulate(
        baseFixture({
          formVersion: "v142",
          directions: [{ faculty: { title: "Davolash fakulteti" } }],
          approvalSteps: [
            {
              step: "dean",
              status: "approved",
              approvedBy: { firstName: "Falonchi", lastName: "Raxmatullayev" },
              date: new Date(2026, 7, 28),
            },
          ],
        }),
      ),
    );

    await expect(buildScienceProgramPdf("spV142")).resolves.toBeDefined();
  });

  test("test #3: formVersion='v142', dean pending — xatosiz quriladi", async () => {
    ScienceProgram.findById = jest.fn().mockReturnValue(
      chainablePopulate(
        baseFixture({
          formVersion: "v142",
          directions: [{ faculty: { title: "Davolash fakulteti" } }],
          approvalSteps: [
            { step: "dean", status: "pending", approvedBy: null, date: null },
          ],
        }),
      ),
    );

    await expect(buildScienceProgramPdf("spV142Pending")).resolves.toBeDefined();
  });

  test("test #4: formVersion undefined (legacy .lean()) — v259 yo'li bilan xatosiz quriladi", async () => {
    const fixture = baseFixture();
    delete fixture.formVersion;
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(fixture));

    await expect(buildScienceProgramPdf("spLegacy")).resolves.toBeDefined();
  });

  test("populate zanjiriga approvalSteps.approvedBy va directions.faculty qo'shilgan (R-4.02-01)", async () => {
    const chain = chainablePopulate(baseFixture({ formVersion: "v259" }));
    ScienceProgram.findById = jest.fn().mockReturnValue(chain);

    await buildScienceProgramPdf("spPopulate");

    expect(chain.populate).toHaveBeenCalledWith(
      "approvalSteps.approvedBy",
      "firstName lastName middleName",
    );
    expect(chain.populate).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "directions",
        populate: expect.objectContaining({ path: "faculty" }),
      }),
    );
  });
});
