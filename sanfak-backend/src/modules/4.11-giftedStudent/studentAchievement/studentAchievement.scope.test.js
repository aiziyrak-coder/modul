jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("#system/notification/notification.service", () => ({ notify: jest.fn() }));
jest.mock("../_services/studentAccess", () => ({
  denyStudentAccess: jest.fn(),
  resolveOwnedGiftedStudentIds: jest.fn(),
}));
jest.mock("../_services/moduleRoles", () => ({ isAchievementReviewer: jest.fn(() => true) }));
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/documentType/documentType.model", () => ({
  find: jest.fn(() => ({ distinct: jest.fn(async () => []) })),
}));

const mockSave = jest.fn();
jest.mock("./studentAchievement.model", () => {
  const Model = jest.fn(function StudentAchievement(doc) {
    Object.assign(this, doc);
    this.save = mockSave;
  });
  Model.find = jest.fn();
  return Model;
});


jest.mock("#modules/4.11-giftedStudent/_services/giftedNotify", () => ({
  notifyStudent: jest.fn(),
  notifyUser: jest.fn(),
  EVENTS: {
    ACHIEVEMENT_REVIEWED: "gifted_achievement_reviewed",
    APPLICATION_REVIEWED: "gifted_application_reviewed",
  },
  LINKS: {
    STUDENT_ACTIVITIES: "/gifted-students/student/activities",
    STUDENT_SCHOLARSHIPS: "/gifted-students/student/scholarships",
  },
}));

const Controller = require("./studentAchievement.controller");
const StudentAchievement = require("./studentAchievement.model");
const {
  denyStudentAccess,
  resolveOwnedGiftedStudentIds,
} = require("../_services/studentAccess");

const OWN = "6a7efdac5916905f06cebeac";
const OTHER = "6a7efdac5916905f06cebead";

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function mockFindChain(docs = []) {
  const chain = {
    populate: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    lean: jest.fn(() => chain),
    exec: jest.fn(async () => docs),
  };
  StudentAchievement.find.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ _id: "new1" });
});

describe("findAllAchievements — egalik doirasi", () => {
  test("talaba: so'rov FAQAT o'z giftedStudent id'si bilan cheklanadi", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue([OWN]);
    mockFindChain([]);

    await Controller.findAllAchievements(
      { user: { _id: "u1", role: { title: "talaba" } }, query: {} },
      mockRes(),
      jest.fn(),
    );

    const [filter] = StudentAchievement.find.mock.calls[0];
    expect(filter.student).toEqual({ $in: [OWN] });
    expect(JSON.stringify(filter)).not.toContain(OTHER);
  });

  test("maslahatchi: faqat o'z advisee'lari", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue([OWN, "adv2"]);
    mockFindChain([]);

    await Controller.findAllAchievements(
      { user: { _id: "adv1", role: { title: "oqituvchi" } }, query: {} },
      mockRes(),
      jest.fn(),
    );

    expect(StudentAchievement.find.mock.calls[0][0].student).toEqual({
      $in: [OWN, "adv2"],
    });
  });

  test("bo'lim/rahbariyat (null) — cheklov QO'YILMAYDI", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue(null);
    mockFindChain([]);

    await Controller.findAllAchievements(
      { user: { _id: "d1", role: { title: "iqtidorli_bolim" } }, query: {} },
      mockRes(),
      jest.fn(),
    );

    expect(StudentAchievement.find.mock.calls[0][0].student).toBeUndefined();
  });

  test("profilsiz rol ([]) — bo'sh ro'yxatga cheklanadi", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue([]);
    mockFindChain([]);

    await Controller.findAllAchievements(
      { user: { _id: "x", role: { title: "boshqa" } }, query: {} },
      mockRes(),
      jest.fn(),
    );

    expect(StudentAchievement.find.mock.calls[0][0].student).toEqual({ $in: [] });
  });

  test("egalik filtri `personalExclusion` bilan BIRGA qo'llanadi", async () => {
    const { isAchievementReviewer } = require("../_services/moduleRoles");
    const DocumentType = require("#modules/4.11-giftedStudent/documentType/documentType.model");
    isAchievementReviewer.mockReturnValueOnce(false);
    DocumentType.find.mockReturnValueOnce({ distinct: jest.fn(async () => ["dt-personal"]) });
    resolveOwnedGiftedStudentIds.mockResolvedValue([OWN]);
    mockFindChain([]);

    await Controller.findAllAchievements(
      { user: { _id: "u1", role: { title: "talaba" } }, query: {} },
      mockRes(),
      jest.fn(),
    );

    const [filter] = StudentAchievement.find.mock.calls[0];
    expect(filter.documentType).toEqual({ $nin: ["dt-personal"] });
    expect(filter.student).toEqual({ $in: [OWN] });
  });

  test("`status` filtri egalik doirasini ALMASHTIRMAYDI", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue([OWN]);
    mockFindChain([]);

    await Controller.findAllAchievements(
      { user: { _id: "u1", role: { title: "talaba" } }, query: { status: "approved" } },
      mockRes(),
      jest.fn(),
    );

    const [filter] = StudentAchievement.find.mock.calls[0];
    expect(filter.student).toEqual({ $in: [OWN] });
    expect(filter.status).toBe("approved");
  });
});

describe("addAchievement — begona talaba nomiga yozib bo'lmaydi", () => {
  test("egalik yo'q bo'lsa SAQLANMAYDI", async () => {
    denyStudentAccess.mockResolvedValue(true);
    const res = mockRes();

    await Controller.addAchievement(
      { user: { _id: "u1", role: { title: "talaba" } }, body: { student: OTHER } },
      res,
      jest.fn(),
    );

    expect(denyStudentAccess).toHaveBeenCalledWith(expect.anything(), res, OTHER);
    expect(mockSave).not.toHaveBeenCalled();
    expect(StudentAchievement).not.toHaveBeenCalled();
  });

  test("egalik bor bo'lsa saqlanadi", async () => {
    denyStudentAccess.mockResolvedValue(false);
    const res = mockRes();

    await Controller.addAchievement(
      { user: { _id: "d1", role: { title: "iqtidorli_bolim" } }, body: { student: OTHER, title: "X" } },
      res,
      jest.fn(),
    );

    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("`student` berilmasa 400 (404 emas) va guard chaqirilmaydi", async () => {
    const res = mockRes();

    await Controller.addAchievement(
      { user: { _id: "d1", role: { title: "iqtidorli_bolim" } }, body: { title: "X" } },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(denyStudentAccess).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe("findAllAchievements — `?search=`", () => {
  const filterOf = () => StudentAchievement.find.mock.calls[0][0];

  const run = async (query) => {
    resolveOwnedGiftedStudentIds.mockResolvedValue(null);
    mockFindChain([]);
    await Controller.findAllAchievements(
      { user: { _id: "d1", role: { title: "iqtidorli_bolim" } }, query },
      mockRes(),
      jest.fn(),
    );
  };

  test("qism-satr bo'yicha, registrga sezgir emas (`title` + `desc`)", async () => {
    await run({ search: "maqola" });
    expect(filterOf().$or).toEqual([
      { title: { $regex: "maqola", $options: "i" } },
      { desc: { $regex: "maqola", $options: "i" } },
    ]);
  });

  test("bo'shliqlar kesiladi va ichkaridagilari siqiladi", async () => {
    await run({ search: "  ilmiy   maqola  " });
    expect(filterOf().$or[0].title.$regex).toBe("ilmiy maqola");
  });

  test("regex metakarakterlari escape qilinadi (mongod Location51091 bermaydi)", async () => {
    await run({ search: "a(b[c+" });
    expect(filterOf().$or[0].title.$regex).toBe("a\\(b\\[c\\+");
  });

  test("kirill matni ham `i` bayrog'i bilan qidiriladi", async () => {
    await run({ search: "Илмий" });
    expect(filterOf().$or[0].title).toEqual({ $regex: "Илмий", $options: "i" });
  });

  test("bo'sh / faqat bo'shliqli so'rov — filtr QO'YILMAYDI (to'liq sahifa)", async () => {
    await run({ search: "   " });
    expect(filterOf().$or).toBeUndefined();
  });

  test("qidiruv EGALIK doirasini almashtirmaydi", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue([OWN]);
    mockFindChain([]);
    await Controller.findAllAchievements(
      { user: { _id: "u1", role: { title: "talaba" } }, query: { search: "maqola" } },
      mockRes(),
      jest.fn(),
    );
    expect(filterOf().student).toEqual({ $in: [OWN] });
    expect(filterOf().$or).toHaveLength(2);
  });
});
