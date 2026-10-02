jest.mock("./teacher.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const TeacherProfileModel = require("./teacher.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const service = require("./teacher.service");
const Controller = require("./teacher.controller");

const PROFILE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const HR_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (body = {}) => ({
  params: { id: PROFILE_ID },
  body,
  query: {},
  scope: {},
  user: { _id: HR_ID, role: { title: "kadrlar" } },
});

const mockUpdated = (doc) => {
  TeacherProfileModel.findOneAndUpdate = jest.fn().mockResolvedValue(doc);
};

const profileDoc = () => ({ _id: PROFILE_ID, user: OWNER_ID });

const mockExisting = () => {
  TeacherProfileModel.findOne = jest
    .fn()
    .mockResolvedValue({ _id: PROFILE_ID, user: OWNER_ID });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockExisting();
  jest.spyOn(service, "syncApprovedPositionToUser").mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("approveProfile — profil egasiga xabar", () => {
  test("`teacherProfile_approved` faqat profil EGASIGA ketadi", async () => {
    mockUpdated(profileDoc());
    const res = createRes();

    await Controller.approveProfile(makeReq({ comment: "ok" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER_ID,
        eventType: "teacherProfile_approved",
        link: "/teacher/profile",
        metadata: { profileId: PROFILE_ID },
      }),
    );
  });

  test("profil topilmasa (404) — dispatch YO'Q", async () => {
    mockUpdated(null);
    const res = createRes();

    await Controller.approveProfile(makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("rejectProfile — sabab bilan xabar", () => {
  test("`teacherProfile_rejected` + sabab matnda", async () => {
    mockUpdated(profileDoc());
    const res = createRes();

    await Controller.rejectProfile(
      makeReq({ comment: "Diplom nusxasi o'qilmaydi" }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const payload = dispatch.mock.calls[0][0];
    expect(payload.userId).toBe(OWNER_ID);
    expect(payload.eventType).toBe("teacherProfile_rejected");
    expect(payload.body).toContain("Diplom nusxasi o'qilmaydi");
  });

  test("`comment` bo'lmasa 400 — dispatch YO'Q", async () => {
    mockUpdated(profileDoc());
    const res = createRes();

    await Controller.rejectProfile(makeReq({}), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("best-effort — bildirishnoma javobni BLOKLAMAYDI", () => {
  test("dispatch xato bersa ham 200 qaytadi (`next` chaqirilmaydi)", async () => {
    dispatch.mockRejectedValueOnce(new Error("socket down"));
    mockUpdated(profileDoc());
    const res = createRes();
    const next = jest.fn();

    await Controller.approveProfile(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Profil tasdiqlandi" });
  });
});
