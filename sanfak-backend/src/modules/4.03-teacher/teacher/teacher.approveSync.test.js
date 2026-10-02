jest.mock("./teacher.model");
jest.mock("#modules/4.01-auth/user/user.model", () => {
  const MockUser = {};
  MockUser.findById = jest.fn();
  MockUser.updateOne = jest.fn();
  return MockUser;
});
jest.mock("#shared/winston.logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
}));

const TeacherProfileModel = require("./teacher.model");
const User = require("#modules/4.01-auth/user/user.model");
const winston = require("#shared/winston.logger");
const Controller = require("./teacher.controller");

const DOC_ID = "cccccccccccccccccccccccc";
const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OLD_POSITION = "111111111111111111111111";
const NEW_POSITION = "222222222222222222222222";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const leanable = (result) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }),
});

const approveReq = () => ({
  params: { id: DOC_ID },
  body: {},
  scope: {},
  user: { _id: "hr-id" },
});

const mockExistingProfile = () => {
  TeacherProfileModel.findOne = jest
    .fn()
    .mockResolvedValue({ _id: DOC_ID, user: USER_ID });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockExistingProfile();
});

describe("approveProfile — ADR-029 lavozim keshini sinxronlash", () => {
  test("approve -> `users.position` profil lavozimi bilan yangilanadi", async () => {
    TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: DOC_ID,
      user: USER_ID,
      position: NEW_POSITION,
    });
    User.findById.mockReturnValue(leanable({ _id: USER_ID, position: OLD_POSITION }));
    User.updateOne.mockResolvedValue({ acknowledged: true });
    const res = createRes();
    const next = jest.fn();

    await Controller.approveProfile(approveReq(), res, next);

    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { position: NEW_POSITION },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("reject -> `users.position` ga HECH NARSA yozilmaydi", async () => {
    TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: DOC_ID,
      user: USER_ID,
      position: NEW_POSITION,
    });
    const res = createRes();

    await Controller.rejectProfile(
      {
        params: { id: DOC_ID },
        body: { comment: "hujjat yetarli emas" },
        scope: {},
        user: { _id: "hr-id" },
      },
      res,
      jest.fn(),
    );

    expect(User.updateOne).not.toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("profilda lavozim yo'q (null) -> `users.position` BO'SHATILMAYDI", async () => {
    TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: DOC_ID,
      user: USER_ID,
      position: null,
    });
    const res = createRes();

    await Controller.approveProfile(approveReq(), res, jest.fn());

    expect(User.updateOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("lavozim allaqachon bir xil -> keraksiz yozuv yo'q (no-op)", async () => {
    TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: DOC_ID,
      user: USER_ID,
      position: OLD_POSITION,
    });
    User.findById.mockReturnValue(leanable({ _id: USER_ID, position: OLD_POSITION }));
    const res = createRes();

    await Controller.approveProfile(approveReq(), res, jest.fn());

    expect(User.findById).toHaveBeenCalledWith(USER_ID);
    expect(User.updateOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("o'z profilini o'zi tasdiqlay olmaydi -> 403, lavozim sinxronlanmaydi", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue({ _id: DOC_ID, user: "hr-id" });
    TeacherProfileModel.findOneAndUpdate = jest.fn();
    const res = createRes();

    await Controller.approveProfile(approveReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(TeacherProfileModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  test("profil topilmasa (yoki scope tashqarisida) -> 404, sinxronlash yo'q", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue(null);
    TeacherProfileModel.findOneAndUpdate = jest.fn();
    const res = createRes();

    await Controller.approveProfile(approveReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(TeacherProfileModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  test("sinxronlash xatosi tasdiqni YIQITMAYDI — winston.warn + 200, console.* yo'q", async () => {
    TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: DOC_ID,
      user: USER_ID,
      position: NEW_POSITION,
    });
    User.findById.mockReturnValue(leanable({ _id: USER_ID, position: OLD_POSITION }));
    User.updateOne.mockRejectedValue(new Error("mongo yozib bo'lmadi"));
    const consoleSpies = [
      jest.spyOn(console, "log").mockImplementation(() => {}),
      jest.spyOn(console, "warn").mockImplementation(() => {}),
      jest.spyOn(console, "error").mockImplementation(() => {}),
    ];
    const res = createRes();
    const next = jest.fn();

    await Controller.approveProfile(approveReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Profil tasdiqlandi" });
    expect(next).not.toHaveBeenCalled();
    expect(winston.warn).toHaveBeenCalledTimes(1);
    consoleSpies.forEach((spy) => {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});

describe("approveProfile — L-05 telefon/email keshini sinxronlash", () => {
  test("approve -> profil contactInfo `users.phone/email` ga ko'chadi", async () => {
    TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: DOC_ID,
      user: USER_ID,
      position: NEW_POSITION,
      contactInfo: { phone: "+998901112233", email: "ikkinchi@example.uz" },
    });
    User.findById
      .mockReturnValueOnce(leanable({ _id: USER_ID, position: NEW_POSITION }))
      .mockReturnValueOnce(leanable({ _id: USER_ID, phone: null, email: null }));
    User.updateOne.mockResolvedValue({ acknowledged: true });
    const res = createRes();

    await Controller.approveProfile(approveReq(), res, jest.fn());

    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { phone: "+998901112233", email: "ikkinchi@example.uz" },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("bo'sh contactInfo — `users` ga yozilmaydi (kesh o'chirilmaydi)", async () => {
    TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: DOC_ID,
      user: USER_ID,
      position: NEW_POSITION,
      contactInfo: { phone: "", email: null },
    });
    User.findById.mockReturnValue(leanable({ _id: USER_ID, position: NEW_POSITION }));
    User.updateOne.mockResolvedValue({ acknowledged: true });

    await Controller.approveProfile(approveReq(), createRes(), jest.fn());

    const contactWrites = User.updateOne.mock.calls.filter(([, patch]) => "phone" in patch || "email" in patch);
    expect(contactWrites).toHaveLength(0);
  });

  test("bir xil qiymat — qayta yozuv yo'q", async () => {
    TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: DOC_ID,
      user: USER_ID,
      position: NEW_POSITION,
      contactInfo: { phone: "+998901112233", email: null },
    });
    User.findById
      .mockReturnValueOnce(leanable({ _id: USER_ID, position: NEW_POSITION }))
      .mockReturnValueOnce(leanable({ _id: USER_ID, phone: "+998901112233", email: null }));
    User.updateOne.mockResolvedValue({ acknowledged: true });

    await Controller.approveProfile(approveReq(), createRes(), jest.fn());

    const contactWrites = User.updateOne.mock.calls.filter(([, patch]) => "phone" in patch || "email" in patch);
    expect(contactWrites).toHaveLength(0);
  });
});
