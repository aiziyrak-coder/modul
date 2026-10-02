jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#references/science/science.model");

const ScienceModel = require("#references/science/science.model");
const { fillMissingCodes, fillMissingCodesFromCatalog } = require("./workingPlan.pdf");

const ID_SLOT = "6a7d69082200e50d919e2b41";
const ID_ALT = "6a7d69082200e50d919e2b42";
const ID_CACHED = "6a7d69082200e50d919e2b43";

const CATALOG = new Map([
  [ID_SLOT, "GTE1234"],
  [ID_ALT, "TE5678"],
  [ID_CACHED, "NEW999"],
]);

const makeSemesters = () => ({
  1: {
    blocks: [
      {
        blockCode: "TF2",
        sciences: [
          {
            code: null,
            title: "Gigiyena. Tibbiy ekologiya",
            science: ID_SLOT,
            alternatives: [
              { science: ID_ALT, code: "", title: "Tibbiy ekologiya" },
              { science: null, code: null, title: "Katalogsiz alternativ" },
            ],
          },
          { code: "OLD111", title: "Keshlangan", science: ID_CACHED },
          { code: null, title: "Katalogsiz fan", science: null },
        ],
      },
    ],
  },
});

describe("fillMissingCodes — sof funksiya", () => {
  it("bo'sh asosiy va alternativ kodini katalogdan to'ldiradi", () => {
    const sems = makeSemesters();
    const n = fillMissingCodes(sems, CATALOG);
    const [slot] = sems[1].blocks[0].sciences;
    expect(slot.code).toBe("GTE1234");
    expect(slot.alternatives[0].code).toBe("TE5678");
    expect(n).toBe(2);
  });

  it("bo'sh bo'lmagan keshni almashtirmaydi", () => {
    const sems = makeSemesters();
    fillMissingCodes(sems, CATALOG);
    expect(sems[1].blocks[0].sciences[1].code).toBe("OLD111");
  });

  it("`science` yo'q qator va alternativga tegmaydi", () => {
    const sems = makeSemesters();
    fillMissingCodes(sems, CATALOG);
    const [slot, , orphan] = sems[1].blocks[0].sciences;
    expect(orphan.code).toBeNull();
    expect(slot.alternatives[1].code).toBeNull();
  });

  it("Map shaklidagi semesters bilan ishlaydi", () => {
    const plain = makeSemesters();
    const sems = new Map([["1", plain[1]]]);
    expect(fillMissingCodes(sems, CATALOG)).toBe(2);
    expect(sems.get("1").blocks[0].sciences[0].code).toBe("GTE1234");
  });

  it("katalogda kod yo'q bo'lsa bo'sh qoladi", () => {
    const sems = makeSemesters();
    fillMissingCodes(sems, new Map());
    expect(sems[1].blocks[0].sciences[0].code).toBeNull();
  });
});

describe("fillMissingCodesFromCatalog — bitta so'rov, yozuvsiz", () => {
  const mockFind = (impl) => {
    const lean = jest.fn(impl);
    const select = jest.fn(() => ({ lean }));
    ScienceModel.find = jest.fn(() => ({ select }));
    return { select, lean };
  };

  afterEach(() => jest.clearAllMocks());

  it("faqat bo'sh kodli, science'li id'lar bilan BIR marta so'raydi", async () => {
    const { select } = mockFind(async () => [
      { _id: ID_SLOT, scienceCode: "GTE1234" },
      { _id: ID_ALT, scienceCode: "TE5678" },
    ]);
    const sems = makeSemesters();
    const n = await fillMissingCodesFromCatalog(sems);

    expect(ScienceModel.find).toHaveBeenCalledTimes(1);
    const [filter] = ScienceModel.find.mock.calls[0];
    expect([...filter._id.$in].sort()).toEqual([ID_SLOT, ID_ALT].sort());
    expect(select).toHaveBeenCalledWith("scienceCode");
    expect(n).toBe(2);
    expect(sems[1].blocks[0].sciences[1].code).toBe("OLD111");
  });

  it("to'ldiriladigan qator bo'lmasa so'rov yubormaydi", async () => {
    mockFind(async () => []);
    const n = await fillMissingCodesFromCatalog({ 1: { blocks: [] } });
    expect(n).toBe(0);
    expect(ScienceModel.find).not.toHaveBeenCalled();
  });

  it("so'rov yiqilsa xatoni yutadi, kesh o'zgarmaydi", async () => {
    mockFind(async () => {
      throw new Error("db down");
    });
    const sems = makeSemesters();
    await expect(fillMissingCodesFromCatalog(sems)).resolves.toBe(0);
    expect(sems[1].blocks[0].sciences[0].code).toBeNull();
  });
});
