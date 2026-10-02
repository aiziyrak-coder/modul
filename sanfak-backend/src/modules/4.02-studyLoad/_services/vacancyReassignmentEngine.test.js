jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#modules/4.03-teacher/teacher/teacher.model");
jest.mock("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");
jest.mock("./annualHoursCalculator", () => ({
  calculateAnnualHours: jest.fn(() => ({ annualHours: 720 })),
}));

const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const User = require("#modules/4.01-auth/user/user.model");
const TeacherProfileModel = require("#modules/4.03-teacher/teacher/teacher.model");
const { ROLES } = require("#config/constants");
const { suggestReplacementTeachers } = require("./vacancyReassignmentEngine");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DEP_ID = "cccccccccccccccccccccccc";
const TEACHER_ID = "dddddddddddddddddddddddd";
const SCIENCE_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const mockDistribution = (blocks) => {
  WorkloadDistribution.findById = jest.fn(() => ({
    populate: () => ({
      lean: () =>
        Promise.resolve({
          _id: DIST_ID,
          department: { _id: DEP_ID },
          academicYear: "2028/2029",
          teachers: [
            {
              _id: ENTRY_ID,
              isVacant: true,
              totalHour: 100,
              blocks,
            },
          ],
        }),
    }),
  }));
};

const mockWorkloadFind = ({ taughtBeforeDocs = [] } = {}) => {
  WorkloadDistribution.find = jest.fn((filter) => ({
    select: () => ({
      lean: () =>
        Promise.resolve(filter?.teachers?.$elemMatch ? taughtBeforeDocs : []),
    }),
  }));
};

beforeEach(() => {
  jest.clearAllMocks();
  TeacherProfileModel.find = jest.fn(() => ({
    distinct: () => Promise.resolve([TEACHER_ID]),
  }));
  User.find = jest.fn(() => ({
    populate: () => ({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: TEACHER_ID,
              firstName: "Nomzod",
              lastName: "O'qituvchi",
              stake: 1,
              position: { annualHours: 720 },
              role: { title: ROLES.OQITUVCHI },
            },
          ]),
      }),
    }),
  }));
  mockWorkloadFind();
});

describe("vacancyReassignmentEngine — vakant fanlar to'plami (String(null) bug)", () => {
  test("science = null bo'lgan blok bilan YIQILMAYDI va so'rov yubormaydi", async () => {
    mockDistribution([{ science: null, totalHour: 100 }]);

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(Array.isArray(res)).toBe(true);
    const taughtBeforeCalls = WorkloadDistribution.find.mock.calls.filter(
      ([filter]) => filter?.teachers?.$elemMatch,
    );
    expect(taughtBeforeCalls).toHaveLength(0);
  });

  test("science = undefined / blok bo'sh — ham xavfsiz", async () => {
    mockDistribution([{ totalHour: 50 }, {}]);

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(Array.isArray(res)).toBe(true);
    const taughtBeforeCalls = WorkloadDistribution.find.mock.calls.filter(
      ([filter]) => filter?.teachers?.$elemMatch,
    );
    expect(taughtBeforeCalls).toHaveLength(0);
  });

  test('HECH QACHON "null" satri so\'rovga tushmaydi', async () => {
    mockDistribution([{ science: null }, { science: SCIENCE_ID }]);

    await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    const taughtBeforeCall = WorkloadDistribution.find.mock.calls.find(
      ([filter]) => filter?.teachers?.$elemMatch,
    );
    expect(taughtBeforeCall).toBeDefined();
    const ids = taughtBeforeCall[0].teachers.$elemMatch["blocks.science"].$in;
    expect(ids).toEqual([SCIENCE_ID]);
    expect(ids).not.toContain("null");
    expect(ids).not.toContain("undefined");
  });

  test("haqiqiy science bo'lsa mezon ISHLAYDI (regressiya bo'lmasin)", async () => {
    mockDistribution([{ science: SCIENCE_ID, totalHour: 100 }]);
    mockWorkloadFind({
      taughtBeforeDocs: [
        { teachers: [{ teacher: TEACHER_ID, blocks: [{ science: SCIENCE_ID }] }] },
        { teachers: [{ teacher: TEACHER_ID, blocks: [{ science: SCIENCE_ID }] }] },
      ],
    });

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    const taughtBeforeCall = WorkloadDistribution.find.mock.calls.find(
      ([filter]) => filter?.teachers?.$elemMatch,
    );
    expect(taughtBeforeCall[0].teachers.$elemMatch).toEqual({
      teacher: { $in: [TEACHER_ID] },
      "blocks.science": { $in: [SCIENCE_ID] },
    });

    const reasons = (res[0]?.reasons || []).join(" | ");
    expect(reasons).toMatch(/Avval shu fanlarni o'qigan \(2 hujjat\)/);
  });
});
