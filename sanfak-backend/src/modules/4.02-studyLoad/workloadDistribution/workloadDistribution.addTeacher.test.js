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

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockDist = () => {
  const teachers = [];
  const dist = {
    _id: DIST_ID,
    status: 'draft',
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

const mockProfile = (positionTitle) => {
  TeacherProfile.findOne = jest.fn(() => ({
    populate: () => ({
      select: () => ({
        lean: () =>
          Promise.resolve(
            positionTitle === undefined
              ? null
              : { position: positionTitle === null ? null : { title: positionTitle } },
          ),
      }),
    }),
  }));
};

const call = async (body) => {
  const res = createRes();
  await Controller.addTeacher(
    { params: { id: DIST_ID }, body, scope: {} },
    res,
    jest.fn(),
  );
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("addTeacher — `position` profildan aniqlanadi", () => {
  test.each([
    ["Professor", "professor"],
    ["Dotsent", "docent"],
    ["Katta o'qituvchi", "senior_teacher"],
    ["Assistent", "assistant"],
  ])("profil lavozimi «%s» → entry.position = %s", async (title, slug) => {
    const dist = mockDist();
    mockProfile(title);

    const res = await call({ teacher: TEACHER_ID, stavka: 1 });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(dist.teachers[0].position).toBe(slug);
    expect(TeacherProfile.findOne).toHaveBeenCalledWith({ user: TEACHER_ID });
  });

  test("body'da `position` berilsa — U USTUN (profil FAQAT guard uchun BIR MARTA o'qiladi)", async () => {
    const dist = mockDist();
    mockProfile("Assistent");

    await call({ teacher: TEACHER_ID, position: "professor" });

    expect(dist.teachers[0].position).toBe("professor");
    expect(TeacherProfile.findOne).toHaveBeenCalledTimes(1);
  });

  test("TeacherProfile topilmadi — 400, hech narsa yozilmaydi (guard)", async () => {
    const dist = mockDist();
    mockProfile(undefined);

    const res = createRes();
    const next = jest.fn();
    await Controller.addTeacher(
      { params: { id: DIST_ID }, body: { teacher: TEACHER_ID }, scope: {} },
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(res.status).not.toHaveBeenCalled();
    expect(dist.teachers).toHaveLength(0);
  });

  test("TeacherProfile active:false — 400, hech narsa yozilmaydi (guard)", async () => {
    const dist = mockDist();
    TeacherProfile.findOne = jest.fn(() => ({
      populate: () => ({
        select: () => ({
          lean: () => Promise.resolve({ active: false, position: null }),
        }),
      }),
    }));

    const res = createRes();
    const next = jest.fn();
    await Controller.addTeacher(
      { params: { id: DIST_ID }, body: { teacher: TEACHER_ID }, scope: {} },
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(dist.teachers).toHaveLength(0);
  });

  test("profilda lavozim yo'q → position null", async () => {
    const dist = mockDist();
    mockProfile(null);

    await call({ teacher: TEACHER_ID });

    expect(dist.teachers[0].position).toBeNull();
  });

  test("noma'lum lavozim nomi → position null", async () => {
    const dist = mockDist();
    mockProfile("Laborant");

    await call({ teacher: TEACHER_ID });

    expect(dist.teachers[0].position).toBeNull();
  });

  test("VAKANT qator uchun profil qidirilmaydi (teacher yo'q)", async () => {
    const dist = mockDist();
    mockProfile("Dotsent");

    const res = await call({ isVacant: true, vacantLabel: "Vakant" });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(TeacherProfile.findOne).not.toHaveBeenCalled();
    expect(dist.teachers[0].isVacant).toBe(true);
  });

  test("teacher yo'q va vakant emas → 400 (mavjud xulq buzilmadi)", async () => {
    mockDist();
    mockProfile("Dotsent");

    const res = await call({});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TeacherProfile.findOne).not.toHaveBeenCalled();
  });
});

describe("addTeacher — takroriy chaqiruv yetim yozuv YARATMAYDI (D30)", () => {
  test("bir xil o'qituvchi ikki marta — YANGI yozuv yaratilmaydi, o'sha id qaytadi", async () => {
    const dist = mockDist();
    mockProfile("Dotsent");

    const first = await call({ teacher: TEACHER_ID, stavka: 1 });
    expect(first.status).toHaveBeenCalledWith(201);
    expect(dist.teachers).toHaveLength(1);
    const firstId = first.json.mock.calls[0][0].teacherEntryId;

    const second = await call({ teacher: TEACHER_ID, stavka: 1 });

    expect(dist.teachers).toHaveLength(1);
    expect(second.status).toHaveBeenCalledWith(200);
    const body = second.json.mock.calls[0][0];
    expect(String(body.teacherEntryId)).toBe(String(firstId));
    expect(body.reused).toBe(true);
  });

  test("qayta ishlatishda formadagi stavka yangilanadi", async () => {
    const dist = mockDist();
    mockProfile("Dotsent");

    await call({ teacher: TEACHER_ID, stavka: 1 });
    await call({ teacher: TEACHER_ID, stavka: 0.5 });

    expect(dist.teachers).toHaveLength(1);
    expect(dist.teachers[0].stavka).toBe(0.5);
  });

  test("BOSHQA o'qituvchi — alohida yozuv yaratiladi", async () => {
    const dist = mockDist();
    mockProfile("Dotsent");

    await call({ teacher: TEACHER_ID, stavka: 1 });
    await call({ teacher: "cccccccccccccccccccccccc", stavka: 1 });

    expect(dist.teachers).toHaveLength(2);
  });

  test("VAKANT slotlar birlashtirilmaydi — har biri alohida", async () => {
    const dist = mockDist();
    mockProfile("Dotsent");

    await call({ isVacant: true, vacantLabel: "Vakant 1" });
    await call({ isVacant: true, vacantLabel: "Vakant 2" });

    expect(dist.teachers).toHaveLength(2);
  });

  test("vakant yozuv eski egasi id'sini saqlasa ham — u qayta ishlatilmaydi", async () => {
    const dist = mockDist();
    mockProfile("Dotsent");

    dist.teachers.push({
      _id: "vacant-entry",
      teacher: TEACHER_ID,
      isVacant: true,
      blocks: [],
    });

    const res = await call({ teacher: TEACHER_ID, stavka: 1 });

    expect(dist.teachers).toHaveLength(2);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
