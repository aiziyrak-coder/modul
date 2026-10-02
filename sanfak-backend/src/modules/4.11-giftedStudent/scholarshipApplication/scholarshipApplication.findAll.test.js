jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("./scholarshipApplication.model", () => ({ paginate: jest.fn() }));
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/scholarship/scholarship.model", () => ({}));
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: { scholarshipResult: jest.fn(() => "") },
}));
jest.mock("../_services/studentAccess", () => ({
  denyStudentAccess: jest.fn(),
  resolveOwnedGiftedStudentIds: jest.fn(),
}));


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

const Controller = require("./scholarshipApplication.controller");
const ScholarshipApplication = require("./scholarshipApplication.model");
const { resolveOwnedGiftedStudentIds } = require("../_services/studentAccess");

const GS_ID = "6a730a291400c46eb138643c";

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const req = (user, query = {}) => ({ user, query });

beforeEach(() => jest.clearAllMocks());

describe("findAll — advisor scope regression", () => {
  test("HAQIQIY advisor (test_oqituvchi_1) — faqat o'z advisee'larining giftedStudent id'lari bilan so'raladi", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue([GS_ID]);
    ScholarshipApplication.paginate.mockResolvedValue({ totalDocs: 1, docs: [] });

    const res = mockRes();
    await Controller.findAll(req({ _id: "adv1", role: { title: "oqituvchi" } }), res, jest.fn());

    expect(ScholarshipApplication.paginate).toHaveBeenCalledWith(
      expect.objectContaining({ giftedStudent: { $in: [GS_ID] } }),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("BEGONA advisor (advisee'si yo'q) — bo'sh $in, boshqa advisorlarning arizalarini ko'rmaydi", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue([]);
    ScholarshipApplication.paginate.mockResolvedValue({ totalDocs: 0, docs: [] });

    const res = mockRes();
    await Controller.findAll(req({ _id: "adv2", role: { title: "oqituvchi" } }), res, jest.fn());

    expect(ScholarshipApplication.paginate).toHaveBeenCalledWith(
      expect.objectContaining({ giftedStudent: { $in: [] } }),
      expect.anything(),
    );
  });

  test("global rol (super_admin/rektor) — giftedStudent filtri qo'shilmaydi (regressiya yo'q)", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue(null);
    ScholarshipApplication.paginate.mockResolvedValue({ totalDocs: 1, docs: [] });

    const res = mockRes();
    await Controller.findAll(req({ _id: "x", role: { title: "super_admin" } }), res, jest.fn());

    const [filterArg] = ScholarshipApplication.paginate.mock.calls[0];
    expect(filterArg).not.toHaveProperty("giftedStudent");
  });
});

describe("findAll — `?search=`", () => {
  const filterOf = () => ScholarshipApplication.paginate.mock.calls[0][0];

  const run = async (query) => {
    resolveOwnedGiftedStudentIds.mockResolvedValue(null);
    ScholarshipApplication.paginate.mockResolvedValue({ totalDocs: 0, docs: [] });
    await Controller.findAll(
      { user: { _id: "d1", role: { title: "iqtidorli_bolim" } }, query },
      mockRes(),
      jest.fn(),
    );
  };

  test("qism-satr bo'yicha, registrga sezgir emas (`scholarshipName`)", async () => {
    await run({ search: "nomdor" });
    expect(filterOf().$or).toEqual([
      { scholarshipName: { $regex: "nomdor", $options: "i" } },
    ]);
  });

  test("bo'shliqlar kesiladi va ichkaridagilari siqiladi", async () => {
    await run({ search: "  Navoiy   nomidagi  " });
    expect(filterOf().$or[0].scholarshipName.$regex).toBe("Navoiy nomidagi");
  });

  test("regex metakarakterlari escape qilinadi", async () => {
    await run({ search: "a(b[c+" });
    expect(filterOf().$or[0].scholarshipName.$regex).toBe("a\\(b\\[c\\+");
  });

  test("bo'sh / faqat bo'shliqli so'rov — filtr QO'YILMAYDI", async () => {
    await run({ search: "  " });
    expect(filterOf().$or).toBeUndefined();
  });

  test("qidiruv EGALIK doirasi bilan BIRGA `paginate` filtriga tushadi", async () => {
    resolveOwnedGiftedStudentIds.mockResolvedValue([GS_ID]);
    ScholarshipApplication.paginate.mockResolvedValue({ totalDocs: 0, docs: [] });
    await Controller.findAll(
      req({ _id: "adv1", role: { title: "oqituvchi" } }, { search: "rektor" }),
      mockRes(),
      jest.fn(),
    );
    expect(filterOf().giftedStudent).toEqual({ $in: [GS_ID] });
    expect(filterOf().$or).toHaveLength(1);
  });
});
