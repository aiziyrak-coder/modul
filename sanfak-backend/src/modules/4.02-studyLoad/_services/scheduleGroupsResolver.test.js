jest.mock("#references/group/group.model", () => ({ find: jest.fn() }));
jest.mock(
  "#modules/4.02-studyLoad/workingSchedule/workingSchedule.model",
  () => ({ updateOne: jest.fn() }),
);

const GroupModel = require("#references/group/group.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { resolveScheduleGroups } = require("./scheduleGroupsResolver");

const SCHED_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DIR_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const COURSE_ID = "cccccccccccccccccccccccc";
const YEAR_ID = "dddddddddddddddddddddddd";
const G1 = "111111111111111111111111";
const G2 = "222222222222222222222222";

const mockDistinct = (ids) => {
  GroupModel.find.mockReturnValue({
    distinct: jest.fn().mockResolvedValue(ids),
  });
};

const schedule = (over = {}) => ({
  _id: SCHED_ID,
  groups: [],
  direction: DIR_ID,
  courseRef: COURSE_ID,
  academicYear: YEAR_ID,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  WorkingScheduleModel.updateOne.mockResolvedValue({ acknowledged: true });
});

describe("resolveScheduleGroups", () => {
  test("surat TO'LA — jonli so'rov yubormaydi, suratni qaytaradi", async () => {
    const out = await resolveScheduleGroups(schedule({ groups: [G1, G2] }));

    expect(out).toEqual([G1, G2]);
    expect(GroupModel.find).not.toHaveBeenCalled();
    expect(WorkingScheduleModel.updateOne).not.toHaveBeenCalled();
  });

  test("surat BO'SH — kontingentdan o'qiydi va suratni tuzatadi", async () => {
    mockDistinct([G1, G2]);

    const out = await resolveScheduleGroups(schedule());

    expect(out).toEqual([G1, G2]);
    expect(GroupModel.find).toHaveBeenCalledWith({
      direction: DIR_ID,
      course: COURSE_ID,
      academicYear: YEAR_ID,
      active: true,
    });
    expect(WorkingScheduleModel.updateOne).toHaveBeenCalledWith(
      { _id: SCHED_ID },
      { $set: { groups: [G1, G2] } },
    );
  });

  test("surat bo'sh, kontingent ham yo'q — bo'sh massiv, YOZUV yo'q", async () => {
    mockDistinct([]);

    const out = await resolveScheduleGroups(schedule());

    expect(out).toEqual([]);
    expect(WorkingScheduleModel.updateOne).not.toHaveBeenCalled();
  });

  test("courseRef yo'q — jonli so'rov YUBORILMAYDI", async () => {
    const out = await resolveScheduleGroups(schedule({ courseRef: null }));

    expect(out).toEqual([]);
    expect(GroupModel.find).not.toHaveBeenCalled();
  });

  test("schedule null — bo'sh massiv", async () => {
    expect(await resolveScheduleGroups(null)).toEqual([]);
    expect(GroupModel.find).not.toHaveBeenCalled();
  });

  test("persist:false — o'qiydi, lekin suratga tegmaydi", async () => {
    mockDistinct([G1]);

    const out = await resolveScheduleGroups(schedule(), { persist: false });

    expect(out).toEqual([G1]);
    expect(WorkingScheduleModel.updateOne).not.toHaveBeenCalled();
  });

  test("suratni yozib bo'lmasa ham natija qaytadi", async () => {
    mockDistinct([G1]);
    WorkingScheduleModel.updateOne.mockRejectedValue(new Error("DB yiqildi"));

    await expect(resolveScheduleGroups(schedule())).resolves.toEqual([G1]);
  });
});
