const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
const service = require("./workingPlan.service");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaa01";
const SP_ID = "cccccccccccccccccccccc01";
const BLOCK_ID = "111111111111111111111101";
const ROW_ID = "222222222222222222222201";
const YEAR_ID = "777777777777777777777701";
const WS = {
  course6Draft: "bbbbbbbbbbbbbbbbbbbbbb06",
  course6Approved: "bbbbbbbbbbbbbbbbbbbbbb16",
  course5Approved: "bbbbbbbbbbbbbbbbbbbbbb05",
  course4InReview: "bbbbbbbbbbbbbbbbbbbbbb04",
};

const selectLean = (value) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

const slotPlan = () => ({
  _id: PLAN_ID,
  studyPlan: SP_ID,
  workingSchedule: WS.course6Draft,
  semesters: {
    1: {
      semester: "1",
      blocks: [
        {
          _id: BLOCK_ID,
          blockCode: "TF2",
          title: "Tanlov fanlari",
          sciences: [{ _id: ROW_ID, title: EMPTY_SLOT_TITLE, science: null, code: null }],
        },
      ],
    },
  },
});

const arrange = (schedules) => {
  jest.spyOn(WorkingPlanModel, "findOne").mockReturnValue(selectLean(slotPlan()));
  jest
    .spyOn(WorkingScheduleModel, "findById")
    .mockReturnValue(selectLean({ status: "draft", academicYear: YEAR_ID, currentCourse: 6 }));
  jest
    .spyOn(WorkingPlanModel, "find")
    .mockReturnValue(selectLean(schedules.map((s) => ({ workingSchedule: s._id }))));
  jest.spyOn(WorkingScheduleModel, "find").mockReturnValue(selectLean(schedules));
};

const callUsage = () =>
  service.getElectiveRowUsage({
    planId: PLAN_ID,
    semKey: "1",
    blockId: BLOCK_ID,
    scienceRowId: ROW_ID,
    scope: {},
  });

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getElectiveRowUsage — bo'sh slot qamrovi (F-09)", () => {
  test("faqat SHU kursdagi qulflanmagan rejalar sanaladi; qulflangani alohida", async () => {
    arrange([
      { _id: WS.course6Draft, status: "draft", currentCourse: 6 },
      { _id: WS.course6Approved, status: "approved", currentCourse: 6 },
      { _id: WS.course5Approved, status: "approved", currentCourse: 5 },
      { _id: WS.course4InReview, status: "in_review", currentCourse: 4 },
    ]);

    const data = await callUsage();

    expect(data.affectedWorkingPlans).toBe(1);
    expect(data.lockedWorkingPlans).toBe(1);
  });

  test("test4 holati: 6 kurs, 5 tasi boshqa kurs va qulflangan → 1 ta reja, qulflangan 0", async () => {
    arrange([
      { _id: WS.course6Draft, status: "draft", currentCourse: 6 },
      { _id: WS.course5Approved, status: "approved", currentCourse: 5 },
      { _id: WS.course4InReview, status: "in_review", currentCourse: 4 },
    ]);

    const data = await callUsage();

    expect(data.affectedWorkingPlans).toBe(1);
    expect(data.lockedWorkingPlans).toBe(0);
  });
});
