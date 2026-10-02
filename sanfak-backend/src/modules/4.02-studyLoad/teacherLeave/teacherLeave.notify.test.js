jest.mock("./teacherLeave.model");
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const TeacherLeave = require("./teacherLeave.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Controller = require("./teacherLeave.controller");
const { ROLES } = require("#config/constants");

const LEAVE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DEPT_ID = "cccccccccccccccccccccccc";
const HEAD_ID = "dddddddddddddddddddddddd";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeLeave = (over = {}) => ({
  _id: LEAVE_ID,
  teacher: TEACHER_ID,
  type: "leave",
  reason: "Ta'til",
  status: "pending",
  distribution: null,
  teacherEntryId: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...over,
});

const mockFound = (doc) => {
  TeacherLeave.findOne = jest.fn().mockResolvedValue(doc);
};

const req = (body = {}) => ({
  params: { id: LEAVE_ID },
  body,
  query: {},
  scope: {},
  user: { _id: "actor", role: { title: ROLES.KAFEDRA_MUDIRI } },
});

beforeEach(() => {
  jest.clearAllMocks();

  UserModel.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ department: DEPT_ID }),
    }),
  });
  UserModel.find = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: HEAD_ID, role: { title: ROLES.KAFEDRA_MUDIRI } },
          { _id: "someone-else", role: { title: ROLES.OQITUVCHI } },
        ]),
      }),
    }),
  });
  WorkloadDistribution.find = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue([]),
  });
  TeacherLeave.mockImplementation((data) => ({
    ...data,
    _id: LEAVE_ID,
    save: jest.fn().mockResolvedValue({ ...data, _id: LEAVE_ID }),
  }));
});

describe("addTeacherLeave — kafedra mudiriga xabar", () => {
  test("`teacherLeave_submitted` FAQAT kafedra mudiriga (o'qituvchiga emas)", async () => {
    const res = createRes();
    await Controller.addTeacherLeave(
      {
        body: { teacher: TEACHER_ID, type: "resignation", reason: "Ishdan bo'shash" },
        user: { _id: TEACHER_ID },
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: HEAD_ID,
        eventType: "teacherLeave_submitted",
        link: "/study-load/teacher-leaves",
        metadata: { leaveId: LEAVE_ID },
      }),
    );
    expect(UserModel.findById).toHaveBeenCalledWith(TEACHER_ID);
    expect(UserModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ department: DEPT_ID, active: true }),
    );
  });

  test("mudir topilmasa — 0 dispatch, ariza baribir yaratiladi", async () => {
    UserModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    const res = createRes();

    await Controller.addTeacherLeave(
      { body: { teacher: TEACHER_ID, type: "leave" }, user: { _id: TEACHER_ID } },
      res,
      jest.fn(),
    );

    expect(dispatch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("approveTeacherLeave / rejectTeacherLeave — ariza EGASIGA xabar", () => {
  test("tasdiqlanganda `teacherLeave_approved` ariza egasiga", async () => {
    const leave = makeLeave();
    mockFound(leave);
    const res = createRes();

    await Controller.approveTeacherLeave(req({ comment: "Ruxsat" }), res, jest.fn());

    expect(leave.status).toBe("approved");
    expect(dispatch).toHaveBeenCalledTimes(1);
    const payload = dispatch.mock.calls[0][0];
    expect(payload.userId).toBe(TEACHER_ID);
    expect(payload.eventType).toBe("teacherLeave_approved");
    expect(payload.body).toContain("Ruxsat");
  });

  test("rad etilganda `teacherLeave_rejected` sabab bilan", async () => {
    const leave = makeLeave();
    mockFound(leave);
    const res = createRes();

    await Controller.rejectTeacherLeave(
      req({ comment: "Hujjat yetarli emas" }),
      res,
      jest.fn(),
    );

    expect(leave.status).toBe("rejected");
    expect(dispatch).toHaveBeenCalledTimes(1);
    const payload = dispatch.mock.calls[0][0];
    expect(payload.userId).toBe(TEACHER_ID);
    expect(payload.eventType).toBe("teacherLeave_rejected");
    expect(payload.body).toContain("Hujjat yetarli emas");
  });

  test("`pending` bo'lmagan arizada (400) — dispatch YO'Q", async () => {
    mockFound(makeLeave({ status: "approved" }));
    const res = createRes();

    await Controller.rejectTeacherLeave(req({ comment: "sabab" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("best-effort — bildirishnoma javobni BLOKLAMAYDI", () => {
  test("dispatch xato bersa ham ariza tasdiqlanadi (200, `next` yo'q)", async () => {
    dispatch.mockRejectedValue(new Error("socket down"));
    const leave = makeLeave();
    mockFound(leave);
    const res = createRes();
    const next = jest.fn();

    await Controller.approveTeacherLeave(req({}), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(leave.status).toBe("approved");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("kafedra qidiruvi xato bersa ham ariza yaratiladi (201)", async () => {
    UserModel.findById = jest.fn(() => {
      throw new Error("connection lost");
    });
    const res = createRes();

    await Controller.addTeacherLeave(
      { body: { teacher: TEACHER_ID, type: "leave" }, user: { _id: TEACHER_ID } },
      res,
      jest.fn(),
    );

    expect(dispatch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
