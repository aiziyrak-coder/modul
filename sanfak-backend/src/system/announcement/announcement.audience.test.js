jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#domain/student/student.model");

const ResidentModel = require("#modules/4.05-residency/resident/resident.model");
const StudentModel = require("#domain/student/student.model");
const {
  buildAudienceOr,
  resolveAudienceFilter,
  resolveAnnouncementAudienceUserIds,
} = require("./announcement.audience");

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const COURSE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER_COURSE_ID = "cccccccccccccccccccccccc";
const DIRECTION_ID = "dddddddddddddddddddddddd";
const OTHER_USER_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

function matchesFilter(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return cond.some((c) => matchesFilter(doc, c));
    if (key === "$and") return cond.every((c) => matchesFilter(doc, c));
    return matchesFieldCondition(doc[key], cond);
  });
}

function matchesFieldCondition(value, cond) {
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    if ("$size" in cond) return Array.isArray(value) && value.length === cond.$size;
    if ("$exists" in cond) return cond.$exists ? value !== undefined : value === undefined;
    if ("$in" in cond) {
      return Array.isArray(value)
        ? value.some((v) => cond.$in.includes(v))
        : cond.$in.includes(value);
    }
  }
  return Array.isArray(value) ? value.includes(cond) : value === cond;
}

const audienceFilter = (userId, myCourses, myDirections) => ({
  $or: buildAudienceOr(userId, myCourses, myDirections),
});

describe("announcement.audience — buildAudienceOr xulq-atvori", () => {
  test("targetsiz (umumiy) e'lon — har qanday foydalanuvchiga ko'rinadi", () => {
    const doc = { targetUsers: [], targetCourses: [], targetDirections: [] };
    expect(matchesFilter(doc, audienceFilter(USER_ID, [], []))).toBe(true);
  });

  test("boshqa foydalanuvchiga yuborilgan e'lon — men uchun KO'RINMAYDI", () => {
    const doc = { targetUsers: [OTHER_USER_ID], targetCourses: [], targetDirections: [] };
    expect(matchesFilter(doc, audienceFilter(USER_ID, [], []))).toBe(false);
  });

  test("menga to'g'ridan-to'g'ri yuborilgan e'lon — ko'rinadi", () => {
    const doc = { targetUsers: [USER_ID], targetCourses: [], targetDirections: [] };
    expect(matchesFilter(doc, audienceFilter(USER_ID, [], []))).toBe(true);
  });

  test("mening kursimga yuborilgan e'lon — ko'rinadi", () => {
    const doc = { targetUsers: [], targetCourses: [COURSE_ID], targetDirections: [] };
    expect(matchesFilter(doc, audienceFilter(USER_ID, [COURSE_ID], []))).toBe(true);
  });

  test("boshqa kursga yuborilgan e'lon, men o'sha kursda emasman — KO'RINMAYDI", () => {
    const doc = { targetUsers: [], targetCourses: [OTHER_COURSE_ID], targetDirections: [] };
    expect(matchesFilter(doc, audienceFilter(USER_ID, [COURSE_ID], []))).toBe(false);
  });

  test("mening yo'nalishimga yuborilgan e'lon — ko'rinadi", () => {
    const doc = { targetUsers: [], targetCourses: [], targetDirections: [DIRECTION_ID] };
    expect(matchesFilter(doc, audienceFilter(USER_ID, [], [DIRECTION_ID]))).toBe(true);
  });

  test("targetUsers maydoni umuman yo'q (eski hujjat, $exists:false) — umumiy hisoblanadi", () => {
    const doc = { targetCourses: [], targetDirections: [] };
    expect(matchesFilter(doc, audienceFilter(USER_ID, [], []))).toBe(true);
  });
});

describe("announcement.audience — resolveAudienceFilter profil o'qishi", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rezident profilidan course/specialty oladi", async () => {
    ResidentModel.findOne = jest.fn().mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ course: COURSE_ID, specialty: DIRECTION_ID }),
      }),
    });
    StudentModel.findOne = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    });

    const audienceOr = await resolveAudienceFilter(USER_ID);
    const doc = { targetUsers: [], targetCourses: [COURSE_ID], targetDirections: [] };
    expect(matchesFilter(doc, { $or: audienceOr })).toBe(true);
  });

  test("profil topilmasa (na rezident, na talaba) — faqat umumiy/o'ziga yuborilgan ko'rinadi", async () => {
    ResidentModel.findOne = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    });
    StudentModel.findOne = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    });

    const audienceOr = await resolveAudienceFilter(USER_ID);
    const targeted = { targetUsers: [], targetCourses: [COURSE_ID], targetDirections: [] };
    expect(matchesFilter(targeted, { $or: audienceOr })).toBe(false);

    const general = { targetUsers: [], targetCourses: [], targetDirections: [] };
    expect(matchesFilter(general, { $or: audienceOr })).toBe(true);
  });
});

describe("announcement.audience — resolveAnnouncementAudienceUserIds (N-10)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("targetUsers bo'sh emas — AYNAN o'sha id'lar, DB so'rovisiz", async () => {
    ResidentModel.find = jest.fn();
    StudentModel.find = jest.fn();

    const ids = await resolveAnnouncementAudienceUserIds({
      targetUsers: [USER_ID, OTHER_USER_ID],
      targetCourses: [],
      targetDirections: [],
    });

    expect(ids).toEqual([USER_ID, OTHER_USER_ID]);
    expect(ResidentModel.find).not.toHaveBeenCalled();
    expect(StudentModel.find).not.toHaveBeenCalled();
  });

  test("hammasi bo'sh (umumiy e'lon) — null, fan-out QILINMAYDI", async () => {
    ResidentModel.find = jest.fn();
    StudentModel.find = jest.fn();

    const ids = await resolveAnnouncementAudienceUserIds({
      targetUsers: [],
      targetCourses: [],
      targetDirections: [],
    });

    expect(ids).toBeNull();
    expect(ResidentModel.find).not.toHaveBeenCalled();
    expect(StudentModel.find).not.toHaveBeenCalled();
  });

  test("targetCourses — mos Resident/Student.user id'lari qaytadi (dublikatsiz)", async () => {
    ResidentModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([{ user: "res-user-1" }]) }),
    });
    StudentModel.find = jest.fn().mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ user: "stu-user-1" }, { user: "res-user-1" }]),
      }),
    });

    const ids = await resolveAnnouncementAudienceUserIds({
      targetUsers: [],
      targetCourses: [COURSE_ID],
      targetDirections: [],
    });

    expect(ResidentModel.find).toHaveBeenCalledWith({
      $or: [{ course: { $in: [COURSE_ID] } }],
    });
    expect(StudentModel.find).toHaveBeenCalledWith({
      $or: [{ course: { $in: [COURSE_ID] } }],
    });
    expect(ids).toEqual(["res-user-1", "stu-user-1"]);
  });

  test("targetDirections — Resident `specialty`, Student `direction` maydonidan qidiradi", async () => {
    ResidentModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    StudentModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });

    await resolveAnnouncementAudienceUserIds({
      targetUsers: [],
      targetCourses: [],
      targetDirections: [DIRECTION_ID],
    });

    expect(ResidentModel.find).toHaveBeenCalledWith({
      $or: [{ specialty: { $in: [DIRECTION_ID] } }],
    });
    expect(StudentModel.find).toHaveBeenCalledWith({
      $or: [{ direction: { $in: [DIRECTION_ID] } }],
    });
  });

  test("user maydoni bo'lmagan hujjatlar (user:null) chetlab o'tiladi", async () => {
    ResidentModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([{ user: null }]) }),
    });
    StudentModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });

    const ids = await resolveAnnouncementAudienceUserIds({
      targetCourses: [COURSE_ID],
      targetDirections: [],
    });

    expect(ids).toEqual([]);
  });
});
