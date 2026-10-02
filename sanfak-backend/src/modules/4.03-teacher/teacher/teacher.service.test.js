jest.mock("#modules/4.01-auth/user/user.model", () => {
  const MockUser = {};
  MockUser.findByIdAndUpdate = jest.fn();
  MockUser.findOneAndUpdate = jest.fn();
  return MockUser;
});

const User = require("#modules/4.01-auth/user/user.model");
const service = require("./teacher.service");

const USER_ID = "cccccccccccccccccccccccc";
const OTHER_USER_ID = "dddddddddddddddddddddddd";
const FILE_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const selectable = (result) => ({ select: () => Promise.resolve(result) });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("addMyDegrees — `$push`, hech qachon URL'dan id olinmaydi", () => {
  test("bitta fayl -> `$push` bilan `User.findByIdAndUpdate(userId, ...)` chaqiriladi", async () => {
    User.findByIdAndUpdate.mockReturnValue(
      selectable({ degrees: { bachelorDegree: [{ title: "d", path: "p" }] } }),
    );

    await service.addMyDegrees(USER_ID, {
      bachelorDegree: [{ title: "Diplom.pdf", path: "https://x/y.pdf" }],
    });

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      {
        $push: {
          "degrees.bachelorDegree": {
            $each: [{ title: "Diplom.pdf", path: "https://x/y.pdf" }],
          },
        },
      },
      { new: true },
    );
  });

  test("bir nechta turdagi fayl bir vaqtda yuklansa hammasi `$push`ga tushadi", async () => {
    User.findByIdAndUpdate.mockReturnValue(selectable({ degrees: {} }));

    await service.addMyDegrees(USER_ID, {
      bachelorDegree: [{ title: "b", path: "pb" }],
      masterDegree: [{ title: "m", path: "pm" }],
    });

    const [, update] = User.findByIdAndUpdate.mock.calls[0];
    expect(Object.keys(update.$push).sort()).toEqual(
      ["degrees.bachelorDegree", "degrees.masterDegree"].sort(),
    );
  });

  test("`degrees` bo'sh/undefined bo'lsa -> 400, `User` chaqirilmaydi", async () => {
    await expect(service.addMyDegrees(USER_ID, undefined)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("userId topilmasa -> 404", async () => {
    User.findByIdAndUpdate.mockReturnValue(selectable(null));
    await expect(
      service.addMyDegrees(USER_ID, { bachelorDegree: [{ title: "d", path: "p" }] }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("removeMyDegree — IDOR himoyasi: filtr HAR DOIM `{_id: userId}`", () => {
  test("noto'g'ri `type` -> 400, `User` chaqirilmaydi", async () => {
    await expect(
      service.removeMyDegree(USER_ID, "notARealType", FILE_ID),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("`User.findOneAndUpdate` FAQAT `{_id: userId}` filtri bilan chaqiriladi — URL'dan boshqa id olinmaydi", async () => {
    User.findOneAndUpdate.mockReturnValue(selectable({ degrees: {} }));

    await service.removeMyDegree(USER_ID, "bachelorDegree", FILE_ID);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $pull: { "degrees.bachelorDegree": { _id: FILE_ID } } },
      { new: true },
    );
  });

  test("IDOR: boshqa userning fileId'si berilsa ham, so'rov FAQAT chaqiruvchining o'z hujjatini qidiradi (boshqa userga umuman tegilmaydi)", async () => {
    User.findOneAndUpdate.mockReturnValue(
      selectable({ degrees: { bachelorDegree: [{ _id: OTHER_USER_ID }] } }),
    );

    await service.removeMyDegree(USER_ID, "bachelorDegree", OTHER_USER_ID);

    const [filter] = User.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: USER_ID });
    expect(filter).not.toHaveProperty("_id", OTHER_USER_ID);
  });

  test("userId topilmasa -> 404", async () => {
    User.findOneAndUpdate.mockReturnValue(selectable(null));
    await expect(
      service.removeMyDegree(USER_ID, "bachelorDegree", FILE_ID),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
