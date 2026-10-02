jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.03-teacher/teacher/teacher.model");
jest.mock("#references/science/science.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const Science = require("#references/science/science.model");
const Controller = require("./workloadDistribution.controller");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const TEACHER_ID = "cccccccccccccccccccccccc";
const OLD_OWNER_ID = "dddddddddddddddddddddddd";
const REQ_USER_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const BLOCK_A = "111111111111111111111111";
const BLOCK_B = "222222222222222222222222";
const BLOCK_C = "333333333333333333333333";
const SCI_A = "444444444444444444444444";
const SCI_B = "555555555555555555555555";
const SCI_C = "666666666666666666666666";
const TEACHER_DEPT = "777777777777777777777777";
const SCIENCE_DEPT_OTHER = "888888888888888888888888";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const selectLean = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

const vacantEntry = (blocks) => ({
  _id: ENTRY_ID,
  isVacant: true,
  teacher: OLD_OWNER_ID,
  totalHour: 0,
  blocks,
});

const mockDist = (entry) => {
  const dist = {
    _id: DIST_ID,
    status: "draft",
    teachers: [entry],
    residueHour: 500,
    save: jest.fn().mockResolvedValue(undefined),
  };
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  return dist;
};

const wireScience = (departmentByScience) => {
  Science.findById = jest.fn((id) =>
    selectLean(
      id in departmentByScience ? { department: departmentByScience[id] } : null,
    ),
  );
};

const wireTeacherProfile = (department) => {
  TeacherProfile.findOne = jest
    .fn()
    .mockReturnValue(selectLean(department === undefined ? null : { department }));
};

const call = async (dist, body) => {
  const res = createRes();
  const next = jest.fn();
  await Controller.fillVacancy(
    {
      params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
      body: { teacher: TEACHER_ID, ...body },
      scope: {},
      user: { _id: REQ_USER_ID },
    },
    res,
    next,
  );
  return { res, next };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("fillVacancy — Faza 2 kross-kafedra 409 darvozasi", () => {
  test("bittasi crossDepartment, sababsiz — 409 + blockIds (faqat kross blok), hech narsa yozilmaydi", async () => {
    const entry = vacantEntry([
      { _id: BLOCK_A, science: SCI_A },
      { _id: BLOCK_B, science: SCI_B },
    ]);
    const dist = mockDist(entry);
    wireTeacherProfile(TEACHER_DEPT);
    wireScience({ [SCI_A]: SCIENCE_DEPT_OTHER, [SCI_B]: TEACHER_DEPT });

    const { next } = await call(dist, {});

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.meta).toMatchObject({
      code: "SUITABILITY_BASIS_REQUIRED",
      suitability: "crossDepartment",
      blockIds: [BLOCK_A],
    });
    expect(dist.save).not.toHaveBeenCalled();
    expect(entry.isVacant).toBe(true);
    expect(entry.teacher).toBe(OLD_OWNER_ID);
  });

  test("sabab berilsa — BITTA sabab HAR bir kross blokka nusxalanadi, match blokka null", async () => {
    const entry = vacantEntry([
      { _id: BLOCK_A, science: SCI_A },
      { _id: BLOCK_B, science: SCI_B },
      { _id: BLOCK_C, science: SCI_C },
    ]);
    const dist = mockDist(entry);
    wireTeacherProfile(TEACHER_DEPT);
    wireScience({
      [SCI_A]: SCIENCE_DEPT_OTHER,
      [SCI_B]: TEACHER_DEPT,
      [SCI_C]: SCIENCE_DEPT_OTHER,
    });

    const { res, next } = await call(dist, {
      suitabilityBasis: "ish_tajribasi",
      suitabilityNote: "10 yillik amaliy tajribaga ega",
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(dist.save).toHaveBeenCalled();

    const [blockA, blockB, blockC] = entry.blocks;
    const expectedJustification = {
      basis: "ish_tajribasi",
      note: "10 yillik amaliy tajribaga ega",
      declaredBy: REQ_USER_ID,
      declaredAt: expect.any(Date),
    };
    expect(blockA.justification).toEqual(expectedJustification);
    expect(blockC.justification).toEqual(expectedJustification);
    expect(blockA.justification).toEqual(blockC.justification);
    expect(blockB.justification).toEqual({
      basis: null,
      note: null,
      declaredBy: null,
      declaredAt: null,
    });
  });

  test("eski egasining bayonnomasi HAR DOIM tozalanadi (F-2a xatosi klassi)", async () => {
    const entry = vacantEntry([
      {
        _id: BLOCK_B,
        science: SCI_B,
        justification: {
          basis: "boshqa",
          note: "eski egadan qolgan izoh",
          declaredBy: OLD_OWNER_ID,
          declaredAt: new Date("2020-01-01"),
        },
      },
    ]);
    const dist = mockDist(entry);
    wireTeacherProfile(TEACHER_DEPT);
    wireScience({ [SCI_B]: TEACHER_DEPT });

    const { res } = await call(dist, {});

    expect(res.status).toHaveBeenCalledWith(200);
    expect(entry.blocks[0].justification).toEqual({
      basis: null,
      note: null,
      declaredBy: null,
      declaredAt: null,
    });
  });

  test("TeacherProfile mavjud emas (bogus id) — 400, hech narsa yozilmaydi", async () => {
    const entry = vacantEntry([{ _id: BLOCK_A, science: SCI_A }]);
    const dist = mockDist(entry);
    wireTeacherProfile(undefined);
    wireScience({});

    const { next } = await call(dist, {});

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(dist.save).not.toHaveBeenCalled();
    expect(entry.isVacant).toBe(true);
    expect(entry.teacher).toBe(OLD_OWNER_ID);
    expect(Science.findById).not.toHaveBeenCalled();
  });

  test("N+1 HOIST: 3 blokda TeacherProfile.findOne AYNAN 1 marta chaqiriladi", async () => {
    const entry = vacantEntry([
      { _id: BLOCK_A, science: SCI_A },
      { _id: BLOCK_B, science: SCI_B },
      { _id: BLOCK_C, science: SCI_C },
    ]);
    const dist = mockDist(entry);
    wireTeacherProfile(TEACHER_DEPT);
    wireScience({ [SCI_A]: TEACHER_DEPT, [SCI_B]: TEACHER_DEPT, [SCI_C]: TEACHER_DEPT });

    await call(dist, {});

    expect(TeacherProfile.findOne).toHaveBeenCalledTimes(1);
    expect(TeacherProfile.findOne).toHaveBeenCalledWith({ user: TEACHER_ID });
    expect(Science.findById).toHaveBeenCalledTimes(3);
  });

  test("unknown/match aralash, kross yo'q — sabab so'ralmaydi, 200", async () => {
    const entry = vacantEntry([
      { _id: BLOCK_A, science: SCI_A },
      { _id: BLOCK_B, science: null },
    ]);
    const dist = mockDist(entry);
    wireTeacherProfile(TEACHER_DEPT);
    wireScience({ [SCI_A]: TEACHER_DEPT });

    const { res, next } = await call(dist, {});

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const empty = { basis: null, note: null, declaredBy: null, declaredAt: null };
    expect(entry.blocks[0].justification).toEqual(empty);
    expect(entry.blocks[1].justification).toEqual(empty);
    expect(entry.blocks[1].suitability.flag).toBe("unknown");
  });
});

describe("fillVacancy — bo'lingan blok (ADR-034) round-trip", () => {
  afterEach(() => jest.resetAllMocks());

  test("classTypeSlugs va filtrlangan studyWork fill'dan keyin o'zgarmaydi (200)", async () => {
    const studyWork = {
      classTypes: [
        { slug: "maruza", title: "Ma'ruza", stream: 2, total: 2 },
        { slug: "amaliy", title: "Amaliy mashg'ulot", stream: 0, total: 0 },
      ],
      items: [{ slug: "yan", value: 0 }],
      thisSemester: { auditoriumHour: 2, teachingAuditoriumHour: 2, totalHour: 2 },
    };
    const entry = vacantEntry([
      { _id: BLOCK_A, science: SCI_A, classTypeSlugs: ["maruza"], studyWork, totalHour: 17 },
    ]);
    const before = JSON.stringify({ slugs: entry.blocks[0].classTypeSlugs, studyWork });
    const dist = mockDist(entry);
    wireTeacherProfile(TEACHER_DEPT);
    wireScience({ [SCI_A]: TEACHER_DEPT });
    const { res, next } = await call(dist, {});
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(entry.isVacant).toBe(false);
    expect(
      JSON.stringify({ slugs: entry.blocks[0].classTypeSlugs, studyWork: entry.blocks[0].studyWork }),
    ).toBe(before);
    expect(entry.blocks[0].totalHour).toBe(17);
  });
});
