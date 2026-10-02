jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model", () => ({
  find: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model", () => {
  const actual = jest.requireActual("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
  return {
    find: jest.fn(),
    computeSemesterTotals: actual.computeSemesterTotals,
  };
});

const WorkingSchedule = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const {
  leafHourCreditTotals,
} = require("#modules/4.02-studyLoad/_services/oubStatsAggregations");

const WS_ID = "6600000000000000000000a1";
const DIR_ID = "6600000000000000000000b1";
const FACULTY_ID = "6600000000000000000000c1";
const OTHER_FACULTY_ID = "6600000000000000000000c2";

const mockFindSelectLean = (mockFn, resolvedDocs) => {
  mockFn.mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(resolvedDocs) }),
  });
};

const buildSemesterFixture = () => ({
  semester: "1",
  blocks: [
    {
      blockCode: "B1",
      sciences: [
        {
          serialNumber: "1",
          code: "ICH01",
          title: "Ichki kasalliklar",
          totalCredit: 20,
          particle: [{ slug: "umumiy_yuklamaning_hajmi_soat", value: 400 }],
        },
        {
          serialNumber: "2",
          code: "JAR01",
          title: "Jarrohlik",
          totalCredit: 12,
          particle: [{ slug: "umumiy_yuklamaning_hajmi_soat", value: 290 }],
        },
      ],
    },
  ],
  blocksTotal: { title: "Jami", totalHour: 1680, totalCredit: 64, weeklyHours: 0, particles: [] },
  practice: { title: "Malakaviy amaliyot", hour: 0, credit: 0, particles: [] },
  grandTotal: { title: "Jami semestrda", totalHour: 1680, totalCredit: 64, weeklyHours: 0, particles: [] },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("leafHourCreditTotals — golden-vektor (leaf 690 soat / 32 kredit, blocksTotal 1680 e'tiborsiz)", () => {
  test("institut jami — DB'dagi stale blocksTotal (1680) emas, leaf yig'indi (690/32) qaytadi", async () => {
    mockFindSelectLean(WorkingSchedule.find, [{ _id: WS_ID, direction: DIR_ID }]);
    mockFindSelectLean(WorkingPlan.find, [
      { workingSchedule: WS_ID, semesters: { "1": buildSemesterFixture() } },
    ]);

    const dirFaculty = new Map([[DIR_ID, FACULTY_ID]]);
    const { total, byFaculty } = await leafHourCreditTotals({
      academicYearId: null,
      facultyId: null,
      dirFaculty,
    });

    expect(total.blocksHour).toBe(690);
    expect(total.blocksCredit).toBe(32);
    expect(total.grandHour).toBe(690);
    expect(total.grandCredit).toBe(32);

    expect(byFaculty.get(FACULTY_ID)).toEqual({
      blocksHour: 690,
      blocksCredit: 32,
      grandHour: 690,
      grandCredit: 32,
    });
  });

  test("facultyId filtri — WorkingSchedule so'rovi mos direction id-ro'yxati bilan chaqiriladi", async () => {
    mockFindSelectLean(WorkingSchedule.find, []);
    mockFindSelectLean(WorkingPlan.find, []);

    const dirFaculty = new Map([[DIR_ID, FACULTY_ID]]);
    const { total } = await leafHourCreditTotals({
      academicYearId: null,
      facultyId: OTHER_FACULTY_ID,
      dirFaculty,
    });

    const callArg = WorkingSchedule.find.mock.calls[0][0];
    expect(callArg.direction.$in).toEqual([]);
    expect(total.blocksHour).toBe(0);
  });

  test("mos workingSchedule topilmasa — bo'sh natija (WorkingPlan so'rovi umuman ketmaydi)", async () => {
    mockFindSelectLean(WorkingSchedule.find, []);

    const { total, byFaculty } = await leafHourCreditTotals({
      academicYearId: null,
      facultyId: null,
      dirFaculty: new Map(),
    });

    expect(total).toEqual({ blocksHour: 0, blocksCredit: 0, grandHour: 0, grandCredit: 0 });
    expect(byFaculty.size).toBe(0);
    expect(WorkingPlan.find).not.toHaveBeenCalled();
  });
});
