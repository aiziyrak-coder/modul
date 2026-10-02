jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model", () => ({ aggregate: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model", () => ({ aggregate: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model", () => ({ countDocuments: jest.fn() }));
jest.mock("#modules/4.01-auth/user/user.model", () => ({ find: jest.fn() }));

const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const TeacherLeave = require("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");
const User = require("#modules/4.01-auth/user/user.model");

const { documentsBlock } = require("./studyLoadStatistics.service");

const FACULTY_A = "6600000000000000000000f1";
const DEPT_IN_A = "6600000000000000000000d1";
const DIR_IN_A = "6600000000000000000000e1";
const TEACHER_ID = "6600000000000000000000u1";

const dirFaculty = new Map([[DIR_IN_A, FACULTY_A]]);
const deptFaculty = new Map([[DEPT_IN_A, FACULTY_A]]);

const mockUserFind = (docs) => {
  User.find.mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(docs) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  Syllabus.aggregate.mockResolvedValue([{ _id: "approved", n: 1 }]);
  ScienceProgram.aggregate.mockResolvedValue([{ _id: "approved", n: 1 }]);
  TeacherLeave.countDocuments.mockResolvedValue(0);
  mockUserFind([]);
});

describe("documentsBlock — facultyId YO'Q (global scope, avvalgi xulq)", () => {
  test("Syllabus/ScienceProgram $match'da faculty/directions filtri YO'Q, User.find chaqirilmaydi", async () => {
    await documentsBlock(null, dirFaculty, deptFaculty);

    const syMatch = Syllabus.aggregate.mock.calls[0][0][0].$match;
    expect(syMatch.faculty).toBeUndefined();
    expect(syMatch.active).toBe(true);

    const spMatch = ScienceProgram.aggregate.mock.calls[0][0][0].$match;
    expect(spMatch.directions).toBeUndefined();

    expect(User.find).not.toHaveBeenCalled();
    const tlMatch = TeacherLeave.countDocuments.mock.calls[0][0];
    expect(tlMatch.teacher).toBeUndefined();
    expect(tlMatch.status).toBe("pending");
    expect(tlMatch.active).toBe(true);
  });
});

describe("documentsBlock — facultyId BOR (faculty scope, P1-01 tuzatildi)", () => {
  test("Syllabus $match.faculty = facultyId", async () => {
    await documentsBlock(FACULTY_A, dirFaculty, deptFaculty);
    const syMatch = Syllabus.aggregate.mock.calls[0][0][0].$match;
    expect(String(syMatch.faculty)).toBe(FACULTY_A);
    expect(syMatch.active).toBe(true);
  });

  test("ScienceProgram $match.directions = {$in: [shu fakultetdagi yo'nalishlar]}", async () => {
    await documentsBlock(FACULTY_A, dirFaculty, deptFaculty);
    const spMatch = ScienceProgram.aggregate.mock.calls[0][0][0].$match;
    expect(spMatch.directions.$in.map(String)).toEqual([DIR_IN_A]);
  });

  test("ScienceProgram/Syllabus BOSHQA fakultetning yo'nalishi/o'zi filtrga TUSHMAYDI", async () => {
    const OTHER_FACULTY = "6600000000000000000000f9";
    await documentsBlock(OTHER_FACULTY, dirFaculty, deptFaculty);
    const spMatch = ScienceProgram.aggregate.mock.calls[0][0][0].$match;
    expect(spMatch.directions.$in).toEqual([]);
    const syMatch = Syllabus.aggregate.mock.calls[0][0][0].$match;
    expect(String(syMatch.faculty)).toBe(OTHER_FACULTY);
  });

  test("TeacherLeave — faqat shu fakultetdagi o'qituvchilarning arizasi sanaladi (User orqali)", async () => {
    mockUserFind([{ _id: TEACHER_ID }]);

    await documentsBlock(FACULTY_A, dirFaculty, deptFaculty);

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { department: { $in: expect.any(Array) } },
          { department: null, faculty: FACULTY_A },
        ],
      }),
    );
    const tlMatch = TeacherLeave.countDocuments.mock.calls[0][0];
    expect(tlMatch.teacher.$in.map(String)).toEqual([TEACHER_ID]);
    expect(tlMatch.status).toBe("pending");
    expect(tlMatch.active).toBe(true);
  });

  test("fakultetda o'qituvchi topilmasa — TeacherLeave.countDocuments bo'sh $in bilan chaqiriladi (0 qaytaradi, institut jami emas)", async () => {
    mockUserFind([]);
    await documentsBlock(FACULTY_A, dirFaculty, deptFaculty);
    const tlMatch = TeacherLeave.countDocuments.mock.calls[0][0];
    expect(tlMatch.teacher.$in).toEqual([]);
  });
});
