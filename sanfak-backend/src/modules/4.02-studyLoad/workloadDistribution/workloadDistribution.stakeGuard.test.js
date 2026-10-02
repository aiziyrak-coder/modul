jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.03-teacher/teacher/teacher.model");
jest.mock("#modules/4.02-studyLoad/_services/workloadValidator", () => ({
  ...jest.requireActual("#modules/4.02-studyLoad/_services/workloadValidator"),
  getActiveNorma: jest.fn().mockResolvedValue(null),
}));

const WorkloadDistribution = require("./workloadDistribution.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const Controller = require("./workloadDistribution.controller");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const ENTRY_ID = "vacant-entry-1";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockDist = (teachers = []) => {
  const dist = {
    _id: DIST_ID,
    status: "draft",
    teachers,
    save: jest.fn().mockImplementation(() => {
      teachers.forEach((t, i) => {
        if (!t._id) t._id = `entry-${i}`;
      });
      return Promise.resolve();
    }),
  };
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  return dist;
};

beforeEach(() => {
  jest.clearAllMocks();
  TeacherProfile.findOne = jest.fn(() => ({
    populate: () => ({
      select: () => ({
        lean: () => Promise.resolve({ position: null, active: true }),
      }),
    }),
    select: () => ({
      lean: () => Promise.resolve({ department: null, active: true }),
    }),
  }));
});

describe("addTeacher — ADR-006 stavka guard", () => {
  test("ro'yxatdan tashqari stavka (1.25) → 400, hujjatga yozilmaydi", async () => {
    const dist = mockDist();
    const res = createRes();
    const next = jest.fn();

    await Controller.addTeacher(
      { params: { id: DIST_ID }, body: { teacher: TEACHER_ID, stavka: 1.25 }, scope: {} },
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/Stavka qiymati ruxsat etilgan ro'yxatda yo'q/);
    expect(dist.teachers).toHaveLength(0);
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("ro'yxatdagi stavka (0.5) → write davom etadi (201)", async () => {
    const dist = mockDist();
    const res = createRes();

    await Controller.addTeacher(
      { params: { id: DIST_ID }, body: { teacher: TEACHER_ID, stavka: 0.5 }, scope: {} },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(dist.teachers[0].stavka).toBe(0.5);
  });
});

describe("fillVacancy — ADR-006 stavka guard", () => {
  const vacantEntry = () => ({
    _id: ENTRY_ID,
    isVacant: true,
    teacher: null,
    totalHour: 0,
    blocks: [],
  });

  test("ro'yxatdan tashqari stavka (1.5) → 400, slot to'ldirilmaydi", async () => {
    const entry = vacantEntry();
    const dist = mockDist([entry]);
    const res = createRes();
    const next = jest.fn();

    await Controller.fillVacancy(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { teacher: TEACHER_ID, stavka: 1.5 },
        scope: {},
      },
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(entry.isVacant).toBe(true);
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("stavka berilmasa — guard ishlamaydi (mavjud xulq buzilmadi)", async () => {
    const entry = vacantEntry();
    const dist = mockDist([entry]);
    const res = createRes();

    await Controller.fillVacancy(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { teacher: TEACHER_ID },
        scope: {},
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dist.save).toHaveBeenCalled();
  });
});
