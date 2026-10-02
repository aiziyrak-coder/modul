jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const Controller = require("./workingSchedule.controller");

const supersede = Controller._supersedePreviousSchedules;

const DIRECTION = "6a75b7a35e352d74b10737fd";
const KEY = { direction: DIRECTION, enrollmentYear: "2025", currentCourse: 1 };

const mockExisting = (docs, { plans = [] } = {}) => {
  jest.spyOn(WorkingPlanModel, "find").mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(plans) }),
  });
  jest
    .spyOn(WorkloadModel, "updateMany")
    .mockResolvedValue({ modifiedCount: 0 });
  return jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
    select: jest.fn().mockResolvedValue(docs),
  });
};

describe("workingSchedule — dublikat qo'riqchisi", () => {
  afterEach(() => jest.restoreAllMocks());

  test("mavjud hujjat yo'q — hech nima o'chmaydi, 'created' qaytadi", async () => {
    const find = mockExisting([]);
    const planDel = jest.spyOn(WorkingPlanModel, "deleteMany");
    const schedDel = jest.spyOn(WorkingScheduleModel, "deleteMany");

    const r = await supersede(KEY);

    expect(r).toEqual({ action: "created", replaced: 0, lockedReplaced: 0 });
    expect(planDel).not.toHaveBeenCalled();
    expect(schedDel).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalledWith({
      direction: DIRECTION,
      enrollmentYear: "2025",
      currentCourse: 1,
    });
  });

  test("draft mavjud — eski hujjat VA uning workingPlan'i o'chiriladi", async () => {
    mockExisting([{ _id: "old1", status: "draft" }]);
    const planDel = jest
      .spyOn(WorkingPlanModel, "deleteMany")
      .mockResolvedValue({ deletedCount: 1 });
    const schedDel = jest
      .spyOn(WorkingScheduleModel, "deleteMany")
      .mockResolvedValue({ deletedCount: 1 });

    const r = await supersede(KEY);

    expect(r).toEqual({ action: "replaced", replaced: 1, lockedReplaced: 0 });
    expect(planDel).toHaveBeenCalledWith({ workingSchedule: { $in: ["old1"] } });
    expect(schedDel).toHaveBeenCalledWith({ _id: { $in: ["old1"] } });
  });

  test("rejected mavjud — u ham almashtiriladi", async () => {
    mockExisting([{ _id: "old2", status: "rejected" }]);
    jest.spyOn(WorkingPlanModel, "deleteMany").mockResolvedValue({});
    const schedDel = jest
      .spyOn(WorkingScheduleModel, "deleteMany")
      .mockResolvedValue({});

    const r = await supersede(KEY);

    expect(r.action).toBe("replaced");
    expect(schedDel).toHaveBeenCalledWith({ _id: { $in: ["old2"] } });
  });

  test.each(["in_review", "approved"])(
    "status='%s' — IMZOLANGAN hujjat HAM almashtiriladi (ADR-010)",
    async (status) => {
      mockExisting([{ _id: "locked1", status }]);
      const planDel = jest
        .spyOn(WorkingPlanModel, "deleteMany")
        .mockResolvedValue({});
      const schedDel = jest
        .spyOn(WorkingScheduleModel, "deleteMany")
        .mockResolvedValue({});

      const r = await supersede(KEY);

      expect(r.action).toBe("replaced");
      expect(r.replaced).toBe(1);
      expect(r.lockedReplaced).toBe(1);
      expect(planDel).toHaveBeenCalledWith({
        workingSchedule: { $in: ["locked1"] },
      });
      expect(schedDel).toHaveBeenCalledWith({ _id: { $in: ["locked1"] } });
    },
  );

  test("ESKI xatti-harakat qaytmadi: qulflangan hujjatda 'skipped' YO'Q", async () => {
    mockExisting([{ _id: "locked1", status: "approved" }]);
    jest.spyOn(WorkingPlanModel, "deleteMany").mockResolvedValue({});
    jest.spyOn(WorkingScheduleModel, "deleteMany").mockResolvedValue({});

    const r = await supersede(KEY);

    expect(r.action).not.toBe("skipped");
    expect(r.reason).toBeUndefined();
  });

  test("aralash holat: hammasi o'chadi, lockedReplaced faqat qulflanganini sanaydi", async () => {
    mockExisting([
      { _id: "draft1", status: "draft" },
      { _id: "rej1", status: "rejected" },
      { _id: "locked1", status: "approved" },
      { _id: "locked2", status: "in_review" },
    ]);
    const planDel = jest
      .spyOn(WorkingPlanModel, "deleteMany")
      .mockResolvedValue({});
    const schedDel = jest
      .spyOn(WorkingScheduleModel, "deleteMany")
      .mockResolvedValue({});

    const r = await supersede(KEY);

    expect(r).toEqual({
      action: "replaced",
      replaced: 4,
      lockedReplaced: 2,
    });
    const ids = ["draft1", "rej1", "locked1", "locked2"];
    expect(planDel).toHaveBeenCalledWith({ workingSchedule: { $in: ids } });
    expect(schedDel).toHaveBeenCalledWith({ _id: { $in: ids } });
  });

  test("enrollmentYear raqam bo'lsa ham string sifatida qidiriladi", async () => {
    const find = mockExisting([]);

    await supersede({ ...KEY, enrollmentYear: 2025 });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentYear: "2025" }),
    );
  });
});

describe("workingSchedule — supersede yuklamani belgilaydi (yetim ref qulfi)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("o'chadigan reja YUKLAMAGA bog'langan bo'lsa — `needsRecalculation` qo'yiladi", async () => {
    mockExisting([{ _id: "old1", status: "approved" }], {
      plans: [{ _id: "plan1" }, { _id: "plan2" }],
    });
    jest.spyOn(WorkingPlanModel, "deleteMany").mockResolvedValue({});
    jest.spyOn(WorkingScheduleModel, "deleteMany").mockResolvedValue({});
    const upd = jest
      .spyOn(WorkloadModel, "updateMany")
      .mockResolvedValue({ modifiedCount: 1 });

    await supersede(KEY);

    expect(upd).toHaveBeenCalledWith(
      { "directions.workingPlan": { $in: ["plan1", "plan2"] } },
      { $set: { needsRecalculation: true } },
    );
  });

  test("o'chadigan reja YO'Q bo'lsa — yuklamaga TEGILMAYDI", async () => {
    mockExisting([{ _id: "old1", status: "draft" }], { plans: [] });
    jest.spyOn(WorkingPlanModel, "deleteMany").mockResolvedValue({});
    jest.spyOn(WorkingScheduleModel, "deleteMany").mockResolvedValue({});
    const upd = jest.spyOn(WorkloadModel, "updateMany");

    await supersede(KEY);

    expect(upd).not.toHaveBeenCalled();
  });
});
