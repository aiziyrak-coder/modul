jest.mock("./teacher.model");

const TeacherProfileModel = require("./teacher.model");
const Controller = require("./teacher.controller");
const { ROLES } = require("#config/constants");

const PROFILE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_ID = "cccccccccccccccccccccccc";
const COLLEAGUE_ID = "dddddddddddddddddddddddd";
const HR_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const DEPARTMENT_SCOPE = { department: "ffffffffffffffffffffffff" };

const userWithRole = (title, id) => ({ _id: id, role: { title } });

const profileDoc = ({ user = OWNER_ID } = {}) => ({
  _id: PROFILE_ID,
  user,
  faculty: "old-faculty",
  changedFields: [],
});

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("updateProfile — EGALIK (a)", () => {
  test("oqituvchi BEGONA profilni PUT — 403, `findOneAndUpdate` CHAQIRILMAYDI", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue(profileDoc());
    TeacherProfileModel.findOneAndUpdate = jest.fn();
    const res = createRes();

    await Controller.updateProfile(
      {
        params: { id: PROFILE_ID },
        body: { faculty: "hack" },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Bu profil sizga tegishli emas",
    });
    expect(TeacherProfileModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("oqituvchi O'Z profilini PUT — 200 (xulq o'zgarmadi)", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue(profileDoc());
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: PROFILE_ID });
    const res = createRes();

    await Controller.updateProfile(
      {
        params: { id: PROFILE_ID },
        body: { faculty: "new-faculty" },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(TeacherProfileModel.findOneAndUpdate).toHaveBeenCalled();
  });

  test("kadrlar BEGONA profilni PUT — 200 (boshqa rollar uchun xulq o'zgarmadi)", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue(profileDoc());
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: PROFILE_ID });
    const res = createRes();

    await Controller.updateProfile(
      {
        params: { id: PROFILE_ID },
        body: { faculty: "new-faculty" },
        scope: {},
        user: userWithRole(ROLES.KADRLAR, HR_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("deleteProfile — EGALIK (b)", () => {
  test("oqituvchi BEGONA profilni DELETE — 403, `deleteOne` CHAQIRILMAYDI", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue(profileDoc());
    TeacherProfileModel.deleteOne = jest.fn();
    const res = createRes();

    await Controller.deleteProfile(
      {
        params: { id: PROFILE_ID },
        body: {},
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(TeacherProfileModel.deleteOne).not.toHaveBeenCalled();
  });

  test("oqituvchi O'Z profilini DELETE — 200 va `deleteOne` chaqiriladi", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue(profileDoc());
    TeacherProfileModel.deleteOne = jest.fn().mockResolvedValue({});
    const res = createRes();

    await Controller.deleteProfile(
      {
        params: { id: PROFILE_ID },
        body: {},
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      jest.fn(),
    );

    expect(TeacherProfileModel.deleteOne).toHaveBeenCalledWith({
      _id: PROFILE_ID,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("doira tashqarisidagi profil — 404 (sabab oshkor etilmaydi)", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue(null);
    TeacherProfileModel.deleteOne = jest.fn();
    const res = createRes();

    await Controller.deleteProfile(
      {
        params: { id: PROFILE_ID },
        body: {},
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(TeacherProfileModel.deleteOne).not.toHaveBeenCalled();
  });
});

describe("approveProfile / rejectProfile — SoD: o'zini o'zi tasdiqlash (c)", () => {
  test("egasi O'Z profilini approve — 403, `findOneAndUpdate` CHAQIRILMAYDI", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue(profileDoc({ user: OWNER_ID }));
    TeacherProfileModel.findOneAndUpdate = jest.fn();
    const res = createRes();

    await Controller.approveProfile(
      {
        params: { id: PROFILE_ID },
        body: {},
        scope: {},
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "O'z profilingizni tasdiqlay/rad eta olmaysiz",
    });
    expect(TeacherProfileModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("egasi O'Z profilini reject — 403", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue(profileDoc({ user: OWNER_ID }));
    TeacherProfileModel.findOneAndUpdate = jest.fn();
    const res = createRes();

    await Controller.rejectProfile(
      {
        params: { id: PROFILE_ID },
        body: { comment: "o'zim rad etdim" },
        scope: {},
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(TeacherProfileModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("super_admin ham O'Z profilini approve QILA OLMAYDI (rolga bog'liq emas)", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue(profileDoc({ user: HR_ID }));
    TeacherProfileModel.findOneAndUpdate = jest.fn();
    const res = createRes();

    await Controller.approveProfile(
      {
        params: { id: PROFILE_ID },
        body: {},
        scope: {},
        user: userWithRole(ROLES.SUPER_ADMIN, HR_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(TeacherProfileModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("kadrlar BEGONA profilni approve — 200 (regressiya, (d))", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue(profileDoc({ user: OWNER_ID }));
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: PROFILE_ID });
    const res = createRes();

    await Controller.approveProfile(
      {
        params: { id: PROFILE_ID },
        body: { comment: "tasdiqlandi" },
        scope: {},
        user: userWithRole(ROLES.KADRLAR, HR_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(TeacherProfileModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: PROFILE_ID },
      expect.objectContaining({
        hrApprovalStatus: "approved",
        hrApprovedBy: HR_ID,
        changedFields: [],
      }),
      { new: true },
    );
  });

  test("kadrlar BEGONA profilni reject — 200 (regressiya, (d))", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue(profileDoc({ user: OWNER_ID }));
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: PROFILE_ID });
    const res = createRes();

    await Controller.rejectProfile(
      {
        params: { id: PROFILE_ID },
        body: { comment: "pasport nusxasi yo'q" },
        scope: {},
        user: userWithRole(ROLES.KADRLAR, HR_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(TeacherProfileModel.findOneAndUpdate).toHaveBeenCalled();
  });

  test("approve — egalik so'rovi `req.scope` bilan qilinadi (IDOR himoyasi saqlangan)", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue(profileDoc({ user: OWNER_ID }));
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: PROFILE_ID });

    await Controller.approveProfile(
      {
        params: { id: PROFILE_ID },
        body: {},
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.KADRLAR, HR_ID),
      },
      createRes(),
      jest.fn(),
    );

    expect(TeacherProfileModel.findOne).toHaveBeenCalledWith(
      { _id: PROFILE_ID, ...DEPARTMENT_SCOPE },
      "user",
    );
  });
});
