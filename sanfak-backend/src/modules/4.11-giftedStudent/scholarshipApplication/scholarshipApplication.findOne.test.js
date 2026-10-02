jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("./scholarshipApplication.model", () => ({ findById: jest.fn() }));
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findById: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/scholarship/scholarship.model", () => ({
  findById: jest.fn(),
}));
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: { scholarshipResult: jest.fn(() => "") },
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
const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");

const APP_ID = "6a7323c447140e64545f8a26";
const GS_ID = "6a730a291400c46eb138643c";
const ADVISOR_REAL = "6a730a291400c46eb138643d";
const ADVISOR_OTHER = "eeeeeeeeeeeeeeeeeeeeeeee";

function stubApplication(doc) {
  const chain = {
    populate: jest.fn(() => chain),
    then: (resolve) => resolve(doc),
  };
  ScholarshipApplication.findById.mockReturnValue(chain);
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const req = (user) => ({ params: { id: APP_ID }, user });

const ADVISOR_PERMS = [
  { section: "giftedStudent", actionKeys: ["read", "readAll"] },
  { section: "chat", actionKeys: ["create"] },
];
const user = (_id, permissions = [], title = "istalgan_nom") => ({
  _id,
  role: { title, permissions },
});

beforeEach(() => jest.clearAllMocks());

describe("findOne — D-100 ownership guard", () => {
  const APPLICATION_DOC = { _id: APP_ID, giftedStudent: { _id: GS_ID }, status: "pending" };

  test("BEGONA advisor (test_oqituvchi_2) — 403/404 (avval 200 edi)", async () => {
    stubApplication(APPLICATION_DOC);
    GiftedStudent.findById.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ advisorId: ADVISOR_REAL, user: null }) }),
    });

    const res = mockRes();
    await Controller.findOne(req(user(ADVISOR_OTHER, ADVISOR_PERMS)), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ giftedStudent: expect.anything() }),
    );
  });

  test("HAQIQIY advisor (test_oqituvchi_1) — 200, qonuniy kirish saqlanadi", async () => {
    stubApplication(APPLICATION_DOC);
    GiftedStudent.findById.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ advisorId: ADVISOR_REAL, user: null }) }),
    });

    const res = mockRes();
    await Controller.findOne(req(user(ADVISOR_REAL, ADVISOR_PERMS)), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(APPLICATION_DOC);
  });

  test("super_admin — 200 (global scope, GiftedStudent'ga so'rov yubormaydi)", async () => {
    stubApplication(APPLICATION_DOC);

    const res = mockRes();
    await Controller.findOne(req(user("x", [], "super_admin")), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(GiftedStudent.findById).not.toHaveBeenCalled();
  });

  test("mavjud bo'lmagan :id — 404 (500 emas)", async () => {
    stubApplication(null);

    const res = mockRes();
    await Controller.findOne(req(user("x", [], "super_admin")), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(GiftedStudent.findById).not.toHaveBeenCalled();
  });
});
