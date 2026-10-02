jest.mock("./teacher.model");
jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getRecipients: jest.fn().mockResolvedValue([]),
  getRecipientsForSteps: jest.fn().mockResolvedValue([]),
  describeOwner: jest.fn().mockResolvedValue(""),
}));
jest.mock("./teacher.service", () => ({
  ...jest.requireActual("./teacher.service"),
  profileDefaultsFromUser: jest
    .fn()
    .mockResolvedValue({ department: null, faculty: null, position: null }),
}));

const TeacherProfileModel = require("./teacher.model");
const Controller = require("./teacher.controller");

const DOC_ID = "cccccccccccccccccccccccc";
const DEPARTMENT_SCOPE = { department: "dddddddddddddddddddddddd" };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("updateProfile — changedFields", () => {
  test("yangilash -> changedFields to'ldi", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue({
      faculty: "old-faculty-id",
      changedFields: [],
    });
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: DOC_ID });
    const res = createRes();

    await Controller.updateProfile(
      {
        params: { id: DOC_ID },
        body: { faculty: "new-faculty-id" },
        scope: DEPARTMENT_SCOPE,
      },
      res,
      jest.fn(),
    );

    expect(TeacherProfileModel.findOne).toHaveBeenCalledWith({
      _id: DOC_ID,
      ...DEPARTMENT_SCOPE,
    });
    expect(TeacherProfileModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: DOC_ID, ...DEPARTMENT_SCOPE },
      expect.objectContaining({ changedFields: ["faculty"] }),
      { new: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("ikki marta ketma-ket yangilash -> belgilar BIRLASHADI (yo'qolmaydi)", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue({
      faculty: "old-faculty-id",
      position: "old-position-id",
      changedFields: [],
    });
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: DOC_ID });

    await Controller.updateProfile(
      {
        params: { id: DOC_ID },
        body: { faculty: "new-faculty-id" },
        scope: DEPARTMENT_SCOPE,
      },
      createRes(),
      jest.fn(),
    );

    TeacherProfileModel.findOne = jest.fn().mockResolvedValue({
      faculty: "new-faculty-id",
      position: "old-position-id",
      changedFields: ["faculty"],
    });

    await Controller.updateProfile(
      {
        params: { id: DOC_ID },
        body: { position: "new-position-id" },
        scope: DEPARTMENT_SCOPE,
      },
      createRes(),
      jest.fn(),
    );

    expect(TeacherProfileModel.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: DOC_ID, ...DEPARTMENT_SCOPE },
      expect.objectContaining({ changedFields: ["faculty", "position"] }),
      { new: true, runValidators: true },
    );
  });

  test("klient o'zi `changedFields` yuborsa e'tiborsiz qoldiriladi", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue({
      faculty: "old-faculty-id",
      changedFields: [],
    });
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: DOC_ID });

    await Controller.updateProfile(
      {
        params: { id: DOC_ID },
        body: {
          faculty: "new-faculty-id",
          changedFields: ["hackedField"],
        },
        scope: DEPARTMENT_SCOPE,
      },
      createRes(),
      jest.fn(),
    );

    expect(TeacherProfileModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: DOC_ID, ...DEPARTMENT_SCOPE },
      expect.objectContaining({ changedFields: ["faculty"] }),
      { new: true, runValidators: true },
    );
  });

  test("begona profilni yangilash (scope mos emas) -> 404 va hech narsa yozilmadi", async () => {
    TeacherProfileModel.findOne = jest.fn().mockResolvedValue(null);
    TeacherProfileModel.findOneAndUpdate = jest.fn();
    const res = createRes();

    await Controller.updateProfile(
      {
        params: { id: DOC_ID },
        body: { faculty: "new-faculty-id" },
        scope: DEPARTMENT_SCOPE,
      },
      res,
      jest.fn(),
    );

    expect(TeacherProfileModel.findOne).toHaveBeenCalledWith({
      _id: DOC_ID,
      ...DEPARTMENT_SCOPE,
    });
    expect(TeacherProfileModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Topilmadi" });
  });
});

describe("addProfile — F-3 (SECURITY, mass-assignment): `user` klientdan olinmaydi", () => {
  test("`req.body.user` (begona id) e'tiborsiz — profil `req.user._id` bilan yaratiladi", async () => {
    TeacherProfileModel.mockImplementation(function ctor(data) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
    });
    const res = createRes();

    await Controller.addProfile(
      {
        body: { user: "begona-user-id", department: "dep1" },
        user: { _id: "requester-id" },
      },
      res,
      jest.fn(),
    );

    const [createdWith] = TeacherProfileModel.mock.calls[0];
    expect(createdWith.user).toBe("requester-id");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("`user` yuborilmasa ham — profil so'rovchining o'zi uchun yaratiladi", async () => {
    TeacherProfileModel.mockImplementation(function ctor(data) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
    });
    const res = createRes();

    await Controller.addProfile(
      { body: { department: "dep1" }, user: { _id: "requester-id" } },
      res,
      jest.fn(),
    );

    const [createdWith] = TeacherProfileModel.mock.calls[0];
    expect(createdWith.user).toBe("requester-id");
    expect(createdWith.hrApprovalStatus).toBe("pending");
  });
});

describe("approveProfile / rejectProfile — changedFields tozalanadi", () => {
  const OTHER_USER_ID = "ffffffffffffffffffffffff";

  test("approve -> changedFields bo'sh", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue({ _id: DOC_ID, user: OTHER_USER_ID });
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: DOC_ID });
    const res = createRes();

    await Controller.approveProfile(
      {
        params: { id: DOC_ID },
        body: {},
        scope: DEPARTMENT_SCOPE,
        user: { _id: "hr-id" },
      },
      res,
      jest.fn(),
    );

    expect(TeacherProfileModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: DOC_ID, ...DEPARTMENT_SCOPE },
      expect.objectContaining({ changedFields: [] }),
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("reject -> changedFields bo'sh", async () => {
    TeacherProfileModel.findOne = jest
      .fn()
      .mockResolvedValue({ _id: DOC_ID, user: OTHER_USER_ID });
    TeacherProfileModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue({ _id: DOC_ID });
    const res = createRes();

    await Controller.rejectProfile(
      {
        params: { id: DOC_ID },
        body: { comment: "sabab" },
        scope: DEPARTMENT_SCOPE,
        user: { _id: "hr-id" },
      },
      res,
      jest.fn(),
    );

    expect(TeacherProfileModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: DOC_ID, ...DEPARTMENT_SCOPE },
      expect.objectContaining({ changedFields: [] }),
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
