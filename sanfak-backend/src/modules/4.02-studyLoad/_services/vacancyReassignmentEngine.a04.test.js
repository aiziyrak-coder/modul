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
const TeacherLeave = require("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");
const { resolvePositionSlug } = require("#modules/4.02-studyLoad/_shared/positionSlug");
const {
  suggestReplacementTeachers,
  getTaughtBeforeCountsBatch,
  reassignVacancy,
} = require("./vacancyReassignmentEngine");

const DIST_ID = "111111111111111111111111";
const ENTRY_ID = "222222222222222222222222";
const DEP_ID = "333333333333333333333333";
const SCIENCE_ID = "444444444444444444444444";
const SCIENCE_OTHER_ID = "555555555555555555555555";
const TEACHER_A_ID = "666666666666666666666666";
const TEACHER_B_ID = "777777777777777777777777";
const TEACHER_NORMAL_ID = "888888888888888888888888";
const TEACHER_WRONG_ROLE_ID = "999999999999999999999999";
const YEAR_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getTaughtBeforeCountsBatch — DEFEKT 1 ($elemMatch)", () => {
  test("qurilgan filtr `teachers.$elemMatch` ichida teacher VA blocks.science'ni BIR XIL elementga bog'laydi", async () => {
    WorkloadDistribution.find = jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve([]) }),
    }));

    await getTaughtBeforeCountsBatch(
      [TEACHER_A_ID],
      new Set([SCIENCE_ID]),
      [YEAR_ID],
    );

    expect(WorkloadDistribution.find).toHaveBeenCalledWith({
      teachers: {
        $elemMatch: {
          teacher: { $in: [TEACHER_A_ID] },
          "blocks.science": { $in: [SCIENCE_ID] },
        },
      },
      academicYear: { $in: [YEAR_ID] },
      status: { $ne: "superseded" },
    });
  });

  test("A boshqa fan o'qigan, B aynan vakant fanni o'qigan — A SOXTA +25 OLMAYDI (defekt tuzatildi)", async () => {
    WorkloadDistribution.find = jest.fn(() => ({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              teachers: [
                { teacher: TEACHER_A_ID, blocks: [{ science: SCIENCE_OTHER_ID }] },
                { teacher: TEACHER_B_ID, blocks: [{ science: SCIENCE_ID }] },
              ],
            },
          ]),
      }),
    }));

    const counts = await getTaughtBeforeCountsBatch(
      [TEACHER_A_ID, TEACHER_B_ID],
      new Set([SCIENCE_ID]),
      [YEAR_ID],
    );

    expect(counts.get(TEACHER_A_ID)).toBeUndefined();
    expect(counts.get(TEACHER_B_ID)).toBe(1);
  });

  test("bitta o'qituvchi bir xil fanni 2 hujjatda o'qigan — hisob 2 bo'ladi", async () => {
    WorkloadDistribution.find = jest.fn(() => ({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { teachers: [{ teacher: TEACHER_A_ID, blocks: [{ science: SCIENCE_ID }] }] },
            { teachers: [{ teacher: TEACHER_A_ID, blocks: [{ science: SCIENCE_ID }] }] },
          ]),
      }),
    }));

    const counts = await getTaughtBeforeCountsBatch(
      [TEACHER_A_ID],
      new Set([SCIENCE_ID]),
      [YEAR_ID],
    );

    expect(counts.get(TEACHER_A_ID)).toBe(2);
  });

  test("vakant fan yo'q bo'lsa so'rov UMUMAN yuborilmaydi", async () => {
    WorkloadDistribution.find = jest.fn();

    const counts = await getTaughtBeforeCountsBatch(
      [TEACHER_A_ID],
      new Set(),
      [YEAR_ID],
    );

    expect(WorkloadDistribution.find).not.toHaveBeenCalled();
    expect(counts.size).toBe(0);
  });
});

describe("suggestReplacementTeachers — DEFEKT 2 (nomzod manbasi)", () => {
  const mockDistribution = () => {
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
                blocks: [{ science: SCIENCE_ID, totalHour: 100 }],
              },
            ],
          }),
      }),
    }));
  };

  const mockEmptyBatchQueries = () => {
    WorkloadDistribution.find = jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve([]) }),
    }));
  };

  const mockUserPool = (pool) => {
    User.find = jest.fn((filter) => ({
      populate: () => ({
        select: () => ({
          lean: () => {
            const ids = (filter?._id?.$in || []).map(String);
            return Promise.resolve(pool.filter((u) => ids.includes(String(u._id))));
          },
        }),
      }),
    }));
  };

  test("TeacherProfile so'rovi to'g'ri filtr bilan chaqiriladi (kafedra + active:{$ne:false})", async () => {
    mockDistribution();
    mockEmptyBatchQueries();
    TeacherProfileModel.find = jest.fn(() => ({ distinct: () => Promise.resolve([]) }));
    mockUserPool([]);

    await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(TeacherProfileModel.find).toHaveBeenCalledWith({
      department: DEP_ID,
      active: { $ne: false },
    });
  });

  test("TeacherProfile'i yo'q foydalanuvchi yakuniy nomzodlar ro'yxatiga kirmaydi", async () => {
    mockDistribution();
    mockEmptyBatchQueries();
    const pool = [
      {
        _id: TEACHER_NORMAL_ID,
        firstName: "Normal",
        position: { annualHours: 720 },
        role: { title: ROLES.OQITUVCHI },
      },
    ];
    mockUserPool(pool);
    TeacherProfileModel.find = jest.fn(() => ({ distinct: () => Promise.resolve([]) }));

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ _id: { $in: [] } }),
    );
    expect(res).toHaveLength(0);
  });

  test("profile.active=false bo'lgan xodim ham yakuniy nomzodlar ro'yxatiga kirmaydi", async () => {
    mockDistribution();
    mockEmptyBatchQueries();
    const pool = [
      {
        _id: TEACHER_NORMAL_ID,
        firstName: "Normal",
        position: { annualHours: 720 },
        role: { title: ROLES.OQITUVCHI },
      },
    ];
    mockUserPool(pool);
    TeacherProfileModel.find = jest.fn(() => ({ distinct: () => Promise.resolve([]) }));

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(res).toHaveLength(0);
  });

  test("kafedra a'zosi, lekin roli `oqituvchi` emas (masalan kafedra_mudiri) — skorlanmaydi", async () => {
    mockDistribution();
    mockEmptyBatchQueries();
    const pool = [
      {
        _id: TEACHER_NORMAL_ID,
        firstName: "Normal",
        position: { annualHours: 720 },
        role: { title: ROLES.OQITUVCHI },
      },
      {
        _id: TEACHER_WRONG_ROLE_ID,
        firstName: "Mudir",
        position: { annualHours: 720 },
        role: { title: ROLES.KAFEDRA_MUDIRI },
      },
    ];
    mockUserPool(pool);
    TeacherProfileModel.find = jest.fn(() => ({
      distinct: () => Promise.resolve([TEACHER_NORMAL_ID, TEACHER_WRONG_ROLE_ID]),
    }));

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(res).toHaveLength(1);
    expect(String(res[0].teacher._id)).toBe(TEACHER_NORMAL_ID);
  });

  test("oddiy o'qituvchi hali ham AVVALGIDEK skorlanadi (regressiya — skor qiymati)", async () => {
    mockDistribution();
    mockEmptyBatchQueries();
    TeacherProfileModel.find = jest.fn(() => ({
      distinct: () => Promise.resolve([TEACHER_NORMAL_ID]),
    }));
    mockUserPool([
      {
        _id: TEACHER_NORMAL_ID,
        firstName: "Normal",
        lastName: "O'qituvchi",
        stake: 1,
        position: { annualHours: 720 },
        academicTitle: { title: "professor" },
        role: { title: ROLES.OQITUVCHI },
      },
    ]);

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(res).toHaveLength(1);
    expect(res[0].score).toBe(40);
    const reasons = res[0].reasons.join(" | ");
    expect(reasons).toMatch(/Bo'sh sig'im: 720 soat/);
    expect(reasons).toMatch(/Ilmiy unvon: professor/);
  });

  const teacherPool = () => [
    { _id: TEACHER_A_ID, firstName: "Ketgan", position: {}, role: { title: ROLES.OQITUVCHI } },
    { _id: TEACHER_B_ID, firstName: "Ketayotgan", position: {}, role: { title: ROLES.OQITUVCHI } },
    { _id: TEACHER_NORMAL_ID, firstName: "Normal", position: {}, role: { title: ROLES.OQITUVCHI } },
  ];

  test("D-23: vakant yozuvning o'z egasi tavsiyadan chetlatiladi", async () => {
    WorkloadDistribution.findById = jest.fn(() => ({
      populate: () => ({
        lean: () =>
          Promise.resolve({
            _id: DIST_ID,
            department: { _id: DEP_ID },
            academicYear: "2028/2029",
            teachers: [
              { _id: ENTRY_ID, teacher: TEACHER_A_ID, isVacant: true, totalHour: 100, blocks: [] },
            ],
          }),
      }),
    }));
    mockEmptyBatchQueries();
    TeacherProfileModel.find = jest.fn(() => ({
      distinct: () => Promise.resolve([TEACHER_A_ID, TEACHER_NORMAL_ID]),
    }));
    mockUserPool(teacherPool());
    TeacherLeave.distinct = jest.fn().mockResolvedValue([]);

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(res.map((r) => String(r.teacher._id))).toEqual([TEACHER_NORMAL_ID]);
  });

  test("D-23: ishdan ketish/ko'chirish arizasi kutilayotgan yoki tasdiqlangan o'qituvchi chetlatiladi", async () => {
    mockDistribution();
    mockEmptyBatchQueries();
    TeacherProfileModel.find = jest.fn(() => ({
      distinct: () => Promise.resolve([TEACHER_B_ID, TEACHER_NORMAL_ID]),
    }));
    mockUserPool(teacherPool());
    TeacherLeave.distinct = jest.fn().mockResolvedValue([TEACHER_B_ID]);

    const res = await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    expect(res.map((r) => String(r.teacher._id))).toEqual([TEACHER_NORMAL_ID]);
    const [field, filter] = TeacherLeave.distinct.mock.calls[0];
    expect(field).toBe("teacher");
    expect(filter.type).toEqual({ $in: ["resignation", "transfer"] });
    expect(filter.status).toEqual({ $in: ["pending", "approved"] });
  });
});

describe("reassignVacancy — D-24 (lavozim)", () => {
  const setup = (profile) => {
    const entry = {
      _id: ENTRY_ID,
      teacher: TEACHER_A_ID,
      isVacant: true,
      totalHour: 100,
      position: "docent",
      blocks: [{ acceptanceStatus: "accepted" }],
    };
    const dist = {
      academicYear: YEAR_ID,
      residueHour: 100,
      teachers: { id: jest.fn(() => entry) },
      save: jest.fn().mockResolvedValue(undefined),
    };
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);
    WorkloadDistribution.find = jest.fn(() => ({ select: () => Promise.resolve([]) }));
    User.findById = jest.fn().mockResolvedValue({ _id: TEACHER_B_ID, position: null });
    TeacherProfileModel.findOne = jest.fn(() => ({
      populate: () => ({ select: () => ({ lean: () => Promise.resolve(profile) }) }),
    }));
    return { dist, entry };
  };

  test("lavozim yangi o'qituvchi profilidan olinadi (eski egasiniki qolmaydi)", async () => {
    const { entry, dist } = setup({ position: { title: "Assistent" } });

    await reassignVacancy({
      distributionId: DIST_ID,
      vacantEntryId: ENTRY_ID,
      newTeacherId: TEACHER_B_ID,
    });

    expect(TeacherProfileModel.findOne).toHaveBeenCalledWith({ user: TEACHER_B_ID });
    expect(entry.position).toBe(resolvePositionSlug("Assistent"));
    expect(entry.position).not.toBe("docent");
    expect(entry.teacher).toBe(TEACHER_B_ID);
    expect(entry.isVacant).toBe(false);
    expect(dist.save).toHaveBeenCalled();
  });

  test("profilda lavozim yo'q — eski lavozim qolmaydi (null)", async () => {
    const { entry } = setup(null);

    await reassignVacancy({
      distributionId: DIST_ID,
      vacantEntryId: ENTRY_ID,
      newTeacherId: TEACHER_B_ID,
    });

    expect(entry.position).toBeNull();
  });
});

describe("suggestReplacementTeachers — DEFEKT 3 (N+1 batching)", () => {
  const mockDistribution = () => {
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
                blocks: [{ science: SCIENCE_ID, totalHour: 100 }],
              },
            ],
          }),
      }),
    }));
  };

  const buildCandidates = (n) =>
    Array.from({ length: n }, (_, i) => ({
      _id: `candidate-${i}`,
      firstName: `T${i}`,
      position: { annualHours: 720 },
      role: { title: ROLES.OQITUVCHI },
    }));

  const runWithN = async (n) => {
    jest.clearAllMocks();
    mockDistribution();
    const candidates = buildCandidates(n);
    TeacherProfileModel.find = jest.fn(() => ({
      distinct: () => Promise.resolve(candidates.map((c) => c._id)),
    }));
    User.find = jest.fn(() => ({
      populate: () => ({
        select: () => ({ lean: () => Promise.resolve(candidates) }),
      }),
    }));
    WorkloadDistribution.find = jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve([]) }),
    }));

    await suggestReplacementTeachers(DIST_ID, ENTRY_ID);

    return {
      teacherProfileCalls: TeacherProfileModel.find.mock.calls.length,
      userCalls: User.find.mock.calls.length,
      workloadDistCalls: WorkloadDistribution.find.mock.calls.length,
    };
  };

  test("N=1 va N=5 nomzodda so'rov soni BIR XIL (candidate soniga bog'liq emas)", async () => {
    const forOne = await runWithN(1);
    const forFive = await runWithN(5);

    expect(forOne).toEqual(forFive);
    expect(forFive.workloadDistCalls).toBe(2);
    expect(forFive.teacherProfileCalls).toBe(1);
    expect(forFive.userCalls).toBe(1);
  });
});
