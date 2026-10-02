jest.mock("./teacherLeave.model");
jest.mock("#modules/4.02-studyLoad/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getDepartmentHeadUserIds: jest.fn().mockResolvedValue([]),
}));
jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ department: null }) }) })),
}));

const TeacherLeave = require("./teacherLeave.model");
const Controller = require("./teacherLeave.controller");

const TEACHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const add = async (body) => {
  const next = jest.fn();
  const res = createRes();
  await Controller.addTeacherLeave({ body, user: { _id: TEACHER_ID } }, res, next);
  return { res, next };
};

describe("addTeacherLeave — D-5 kesishuvchi ta'til", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TeacherLeave.mockImplementation((data) => ({
      ...data,
      _id: "leave-new",
      save: jest.fn().mockResolvedValue({ ...data, _id: "leave-new", status: "pending" }),
    }));
  });

  const leave = { type: "leave", reason: "x", fromDate: "2024-03-22", toDate: "2024-03-24" };

  test("kesishuvchi ta'til bor — 409, ariza yaratilmaydi", async () => {
    TeacherLeave.exists = jest.fn().mockResolvedValue({ _id: "leave-2" });

    const { next } = await add(leave);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
    expect(TeacherLeave).not.toHaveBeenCalled();
    expect(TeacherLeave.exists).toHaveBeenCalledWith({
      teacher: TEACHER_ID,
      type: "leave",
      status: { $in: ["pending", "approved"] },
      active: { $ne: false },
      fromDate: { $lte: "2024-03-24" },
      toDate: { $gte: "2024-03-22" },
    });
  });

  test("kesishuv yo'q — 201", async () => {
    TeacherLeave.exists = jest.fn().mockResolvedValue(null);
    const { res } = await add(leave);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("ishdan ketish arizasi — kesishuv tekshirilmaydi (D-6 oqimi)", async () => {
    TeacherLeave.exists = jest.fn();
    await add({ type: "resignation", reason: "x", fromDate: "2024-03-23" });
    expect(TeacherLeave.exists).not.toHaveBeenCalled();
  });
});
