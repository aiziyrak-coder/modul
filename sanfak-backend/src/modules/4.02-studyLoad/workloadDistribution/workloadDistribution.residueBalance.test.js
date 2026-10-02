jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.03-teacher/teacher/teacher.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const Controller = require("./workloadDistribution.controller");

beforeEach(() => {
  TeacherProfile.findOne = jest.fn().mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ department: null }) }),
  });
});

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const TEACHER_A = "cccccccccccccccccccccccc";
const TEACHER_B = "dddddddddddddddddddddddd";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDoc = ({ isVacant }) => {
  const entry = {
    _id: ENTRY_ID,
    teacher: isVacant ? null : TEACHER_A,
    totalHour: 180,
    isVacant,
    blocks: [{ totalHour: 180 }],
  };
  const doc = {
    _id: DIST_ID,
    status: 'draft',
    totalHour: 2340,
    residueHour: isVacant ? 2340 : 2160,
    teachers: [entry],
    save: jest.fn().mockResolvedValue(undefined),
  };
  doc.teachers.find = Array.prototype.find.bind(doc.teachers);
  return doc;
};

const invariantHolds = (doc) => {
  const sum = doc.teachers
    .filter((t) => !t.isVacant)
    .reduce((a, t) => a + (t.totalHour || 0), 0);
  return doc.residueHour === doc.totalHour - sum;
};

describe("workloadDistribution — qoldiq soat balansi (vakant tsikli)", () => {
  afterEach(() => jest.resetAllMocks());

  test("fillVacancy — soat qoldiqdan AYIRILADI (D29)", async () => {
    const doc = makeDoc({ isVacant: true });
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();

    await Controller.fillVacancy(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { teacher: TEACHER_B },
        user: { _id: "u1" },
        scope: {},
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.residueHour).toBe(2160);
    expect(doc.teachers[0].isVacant).toBe(false);
    expect(invariantHolds(doc)).toBe(true);
  });

  test("vakantga o'tkazish → to'ldirish TSIKLI qoldiqni o'zgartirmaydi", async () => {
    const doc = makeDoc({ isVacant: false });
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);

    await Controller.vacateTeacher(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { reason: "resignation" },
        user: { _id: "u1" },
        scope: {},
      },
      createRes(),
      jest.fn(),
    );
    expect(doc.residueHour).toBe(2340);

    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
    await Controller.fillVacancy(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { teacher: TEACHER_B },
        user: { _id: "u1" },
        scope: {},
      },
      createRes(),
      jest.fn(),
    );

    expect(doc.residueHour).toBe(2160);
    expect(invariantHolds(doc)).toBe(true);
  });

  test("vakant bo'lmagan slotni to'ldirishga urinish — 400 (qoldiq tegilmaydi)", async () => {
    const doc = makeDoc({ isVacant: false });
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();

    await Controller.fillVacancy(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { teacher: TEACHER_B },
        user: { _id: "u1" },
        scope: {},
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(doc.residueHour).toBe(2160);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("fillVacancy — blok darajasidagi qabul holati reset (F-2a)", () => {
  afterEach(() => jest.resetAllMocks());

  test("barcha entry.blocks[].acceptanceStatus 'pending'ga qaytariladi, rejectionReason/respondedAt null", async () => {
    const doc = makeDoc({ isVacant: true });
    doc.teachers[0].blocks = [
      {
        totalHour: 90,
        acceptanceStatus: "accepted",
        rejectionReason: null,
        respondedAt: new Date("2026-08-01T00:00:00Z"),
      },
      {
        totalHour: 90,
        acceptanceStatus: "rejected",
        rejectionReason: "eski sabab",
        respondedAt: new Date("2026-08-02T00:00:00Z"),
      },
    ];
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();

    await Controller.fillVacancy(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { teacher: TEACHER_B },
        user: { _id: "u1" },
        scope: {},
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.teachers[0].acceptanceStatus).toBe("pending");
    for (const block of doc.teachers[0].blocks) {
      expect(block.acceptanceStatus).toBe("pending");
      expect(block.rejectionReason).toBeNull();
      expect(block.respondedAt).toBeNull();
    }
  });
});
