const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const { countDerivedWorkingPlans } = require("./studyPlan.derivationGuard");

describe("studyPlan.derivationGuard — countDerivedWorkingPlans", () => {
  afterEach(() => jest.restoreAllMocks());

  test("bitta id (string) — massivga o'raladi va $in bilan so'raladi", async () => {
    const spy = jest
      .spyOn(WorkingPlanModel, "countDocuments")
      .mockResolvedValue(3);

    const result = await countDerivedWorkingPlans("sp1");

    expect(spy).toHaveBeenCalledWith({ studyPlan: { $in: ["sp1"] } });
    expect(result).toBe(3);
  });

  test("bir nechta id (massiv) — hammasi $in ichida", async () => {
    const spy = jest
      .spyOn(WorkingPlanModel, "countDocuments")
      .mockResolvedValue(7);

    const result = await countDerivedWorkingPlans(["sp1", "sp2"]);

    expect(spy).toHaveBeenCalledWith({ studyPlan: { $in: ["sp1", "sp2"] } });
    expect(result).toBe(7);
  });

  test("bo'sh massiv — DB'ga so'rov YUBORILMAYDI, natija 0", async () => {
    const spy = jest.spyOn(WorkingPlanModel, "countDocuments");

    const result = await countDerivedWorkingPlans([]);

    expect(spy).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  test("null/undefined elementlar $in'ga tushmasdan filtrlanadi", async () => {
    const spy = jest
      .spyOn(WorkingPlanModel, "countDocuments")
      .mockResolvedValue(0);

    await countDerivedWorkingPlans([null, "sp1", undefined]);

    expect(spy).toHaveBeenCalledWith({ studyPlan: { $in: ["sp1"] } });
  });
});
