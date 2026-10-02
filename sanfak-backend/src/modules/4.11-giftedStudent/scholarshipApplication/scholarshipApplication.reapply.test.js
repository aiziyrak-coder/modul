jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: { scholarshipResult: jest.fn(() => "") },
}));

jest.mock("./scholarshipApplication.model", () => {
  function Model(data) {
    Object.assign(this, data);
    this.save = jest.fn(async () => {
      Model.__saved.push(this);
      return this;
    });
  }
  Model.findOne = jest.fn();
  Model.__saved = [];
  return Model;
});
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/scholarship/scholarship.model", () => ({
  findById: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/_services/giftedNotify", () => ({
  notifyStudent: jest.fn(),
  notifyUser: jest.fn(),
  EVENTS: {},
  LINKS: {},
}));

const Controller = require("./scholarshipApplication.controller");
const ScholarshipApplication = require("./scholarshipApplication.model");
const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const ScholarshipModel = require("#modules/4.11-giftedStudent/scholarship/scholarship.model");

const SCH_ID = "64b2f0c2a1b2c3d4e5f60718";
const YEAR = "2025/2026";

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const req = (over = {}) => ({
  user: { _id: "u1" },
  body: {
    scholarship: SCH_ID,
    type: "nomdor_stipendiya",
    scholarshipName: "Beruniy",
    academicYear: YEAR,
    ...over,
  },
});

const rejectedDoc = (over = {}) => ({
  _id: "old-app",
  status: "rejected",
  rejectReason: "Hujjat sifati past",
  reviewedBy: "staff-1",
  reviewedAt: new Date("2026-09-01T10:00:00Z"),
  scholarshipName: "Beruniy",
  motivation: "eski matn",
  documents: [{ title: "eski" }],
  period: "eski davr",
  academicYear: YEAR,
  reviewHistory: [],
  save: jest.fn(async function saveSelf() {
    return this;
  }),
  ...over,
});

function arrangeRejected(doc) {
  ScholarshipApplication.findOne
    .mockReturnValueOnce(Promise.resolve(null))
    .mockReturnValueOnce({ sort: jest.fn(() => Promise.resolve(doc)) });
}

const {
  currentAcademicYear,
} = require("#modules/4.11-giftedStudent/_services/academicYearWindow");

beforeEach(() => {
  jest.clearAllMocks();
  ScholarshipApplication.__saved.length = 0;
  GiftedStudent.findOne.mockResolvedValue({
    _id: "gs1",
    totalScore: 100,
    scoresByYear: { [currentAcademicYear()]: 100 },
  });
  ScholarshipModel.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ minScore: 10 }),
  });
});

describe("applyForScholarship — rad etilgan ariza QAYTA ISHLATILADI (D-67)", () => {
  test("🔴 yangi hujjat YARATILMAYDI — eskisi `pending` ga qaytadi", async () => {
    const doc = rejectedDoc();
    arrangeRejected(doc);
    const res = mockRes();

    await Controller.applyForScholarship(req(), res, jest.fn());

    expect(ScholarshipApplication.__saved).toHaveLength(0);
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(doc.status).toBe("pending");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("rad etish sababi YO'QOLMAYDI — tarixga ko'chadi", async () => {
    const doc = rejectedDoc();
    arrangeRejected(doc);

    await Controller.applyForScholarship(req(), mockRes(), jest.fn());

    expect(doc.reviewHistory).toHaveLength(1);
    expect(doc.reviewHistory[0]).toMatchObject({
      status: "rejected",
      note: "Hujjat sifati past",
      reviewedBy: "staff-1",
    });
    expect(doc.reviewHistory[0].supersededAt).toBeInstanceOf(Date);
    expect(doc.rejectReason).toBeUndefined();
    expect(doc.reviewedBy).toBeUndefined();
    expect(doc.reviewedAt).toBeUndefined();
  });

  test("qayta topshirish sanasi YANGILANADI", async () => {
    const doc = rejectedDoc({ appliedAt: new Date("2020-01-01T00:00:00Z") });
    arrangeRejected(doc);

    await Controller.applyForScholarship(req(), mockRes(), jest.fn());

    expect(doc.appliedAt.getUTCFullYear()).toBeGreaterThan(2020);
  });

  test("faqat KELGAN maydon yangilanadi — bo'shi eskisini o'chirmaydi", async () => {
    const doc = rejectedDoc();
    arrangeRejected(doc);

    await Controller.applyForScholarship(
      req({ scholarshipName: "Yangi nom", motivation: undefined, documents: undefined, period: undefined }),
      mockRes(),
      jest.fn(),
    );

    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(doc.scholarshipName).toBe("Yangi nom");

    expect(doc.motivation).toBe("eski matn");
    expect(doc.documents).toEqual([{ title: "eski" }]);
    expect(doc.period).toBe("eski davr");
  });

  test("qayta ishlatish qidiruvi RAD ETILGAN + O'SHA YIL bilan cheklangan", async () => {
    arrangeRejected(rejectedDoc());
    await Controller.applyForScholarship(req(), mockRes(), jest.fn());

    const reuseFilter = ScholarshipApplication.findOne.mock.calls[1][0];
    expect(reuseFilter.status).toBe("rejected");
    expect(reuseFilter.scholarship).toBe(SCH_ID);
    expect(reuseFilter.academicYear).toBe(YEAR);
  });

  test("rad etilgan ariza YO'Q bo'lsa — odatdagidek YANGI hujjat", async () => {
    ScholarshipApplication.findOne
      .mockReturnValueOnce(Promise.resolve(null))
      .mockReturnValueOnce({ sort: jest.fn(() => Promise.resolve(null)) });
    const res = mockRes();

    await Controller.applyForScholarship(req(), res, jest.fn());

    expect(ScholarshipApplication.__saved).toHaveLength(1);
    expect(ScholarshipApplication.__saved[0]).toMatchObject({
      giftedStudent: "gs1",
      scholarship: SCH_ID,
      academicYear: YEAR,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("FAOL ariza bo'lsa qayta ishlatish qidiruvi UMUMAN yuborilmaydi", async () => {
    ScholarshipApplication.findOne.mockResolvedValueOnce({ _id: "a1", status: "pending" });
    const res = mockRes();

    await Controller.applyForScholarship(req(), res, jest.fn());

    expect(ScholarshipApplication.findOne).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
