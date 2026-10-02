jest.mock("./user.model");
jest.mock("./user.service");
jest.mock("#modules/4.01-auth/_shared/escalationGuard", () => ({
  assertCanAssignRole: jest.fn().mockResolvedValue(undefined),
  assertUserEditable: jest.fn().mockResolvedValue(undefined),
  assertCanChangePin: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.03-teacher/teacher/teacher.model", () => ({
  exists: jest.fn(),
}));

const {
  createMockReq,
  createMockRes,
  createMockNext,
} = require("../../../../test/helpers/mockResponse");
const UserModel = require("./user.model");
const TeacherProfileModel = require("#modules/4.03-teacher/teacher/teacher.model");
const Controller = require("./user.controller");

const TARGET_ID = "507f1f77bcf86cd799439022";
const OLD_POSITION = "111111111111111111111111";
const NEW_POSITION = "222222222222222222222222";

const leanable = (result) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }),
});

const runUpdate = async (body) => {
  const req = createMockReq({ params: { id: TARGET_ID }, body });
  const res = createMockRes();
  const next = createMockNext();
  await Controller.update(req, res, next);
  return { res, next };
};

beforeEach(() => {
  jest.clearAllMocks();
  UserModel.findByIdAndUpdate.mockResolvedValue({ _id: TARGET_ID });
});

describe("user.controller.update — ADR-029 lavozim guardi", () => {
  test("bir xil lavozim (forma to'liq body yuboradi) -> o'tadi, 409 YO'Q", async () => {
    UserModel.findById.mockReturnValue(leanable({ position: OLD_POSITION }));

    const { res, next } = await runUpdate({
      firstName: "Alisher",
      position: OLD_POSITION,
    });

    expect(TeacherProfileModel.exists).not.toHaveBeenCalled();
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("farqli lavozim + TASDIQLANGAN profil -> 409, hech narsa yozilmaydi", async () => {
    UserModel.findById.mockReturnValue(leanable({ position: OLD_POSITION }));
    TeacherProfileModel.exists.mockResolvedValue({ _id: "profile-id" });

    const { next } = await runUpdate({ position: NEW_POSITION });

    expect(TeacherProfileModel.exists).toHaveBeenCalledWith({
      user: TARGET_ID,
      hrApprovalStatus: "approved",
    });
    expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(409);
  });

  test("farqli lavozim + profil YO'Q -> o'tadi (admin erkin o'zgartiradi)", async () => {
    UserModel.findById.mockReturnValue(leanable({ position: OLD_POSITION }));
    TeacherProfileModel.exists.mockResolvedValue(null);

    const { res, next } = await runUpdate({ position: NEW_POSITION });

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("farqli lavozim + `pending` profil -> o'tadi (faqat `approved` bloklaydi)", async () => {
    UserModel.findById.mockReturnValue(leanable({ position: OLD_POSITION }));
    TeacherProfileModel.exists.mockResolvedValue(null);

    const { res, next } = await runUpdate({ position: NEW_POSITION });

    expect(TeacherProfileModel.exists).toHaveBeenCalledWith({
      user: TARGET_ID,
      hrApprovalStatus: "approved",
    });
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("`position` body'da YO'Q -> tekshiruv umuman ishlamaydi (qo'shimcha so'rov yo'q)", async () => {
    const { res, next } = await runUpdate({ firstName: "Alisher" });

    expect(UserModel.findById).not.toHaveBeenCalled();
    expect(TeacherProfileModel.exists).not.toHaveBeenCalled();
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
