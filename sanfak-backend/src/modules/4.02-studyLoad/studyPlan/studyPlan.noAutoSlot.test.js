jest.mock("#shared/pythonParser", () => ({
  parseReja: jest.fn(),
  fileUrlToPath: jest.fn(() => "/tmp/reja.xlsx"),
}));
jest.mock("#references/_services/educationActivityResolver", () => ({
  enrichMetaWithSlugRefs: jest.fn(async (m) => m),
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#references/science/science.model", () => ({ find: jest.fn() }));

const { parseReja } = require("#shared/pythonParser");
const ScienceModel = require("#references/science/science.model");
const Controller = require("./studyPlan.controller");
const { EMPTY_SLOT_TITLE } = require(
  "#modules/4.02-studyLoad/_shared/electiveQuotaSlot",
);

let createdDoc = null;
jest.mock("./studyPlan.model", () => ({
  create: jest.fn((doc) => {
    createdDoc = doc;
    return Promise.resolve({ _id: "sp1", ...doc });
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  createdDoc = null;
  ScienceModel.find.mockReturnValue({
    select: () => ({ lean: async () => [] }),
  });
});

describe("import — bo'sh tanlov slot YASALMAYDI (ADR-025 invariant #1)", () => {
  test("kvota-only TF2 blokida sciences.length manba fayldagi qator soniga teng", async () => {
    const sourceRows = [
      { serialNumber: "", code: "", title: "Jami" },
      { serialNumber: "", code: "", title: "Malakaviy amaliyot" },
      { serialNumber: "", code: "TM104", title: "Tanishuv amaliyoti" },
      { serialNumber: "", code: "", title: "HAMMASI" },
    ];

    parseReja.mockResolvedValue({
      meta: {},
      blocks: [
        {
          blockCode: "TF2",
          title: "Tanlov fanlar",
          semesters: { 3: { hour: 3, credit: 3 } },
          sciences: sourceRows.map((r) => ({ ...r })),
        },
      ],
    });

    await Controller.subAddFormXlsx({
      file: "/files/reja.xlsx",
      learningProcess: "lp1",
    });

    expect(createdDoc).not.toBeNull();
    const block = createdDoc.blocks[0];
    expect(block.sciences).toHaveLength(sourceRows.length);
    expect(
      block.sciences.some((s) => s.title === EMPTY_SLOT_TITLE),
    ).toBe(false);
  });
});
