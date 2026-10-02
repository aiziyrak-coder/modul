jest.mock("./teacher.model");

const TeacherProfileModel = require("./teacher.model");
const Controller = require("./teacher.controller");

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createChain = (resolvedValue) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("findAllProfiles — ?user= filtri", () => {
  test("`user` query berilsa mongo filtriga tushadi", async () => {
    const chain = createChain([]);
    TeacherProfileModel.find = jest.fn().mockReturnValue(chain);

    await Controller.findAllProfiles(
      { query: { user: USER_ID }, scope: {} },
      createRes(),
      jest.fn(),
    );

    const [filter] = TeacherProfileModel.find.mock.calls[0];
    expect(filter.user).toBe(USER_ID);
  });

  test("`user` berilmasa filtrga qo'shilmaydi (butun ro'yxat)", async () => {
    const chain = createChain([]);
    TeacherProfileModel.find = jest.fn().mockReturnValue(chain);

    await Controller.findAllProfiles(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    const [filter] = TeacherProfileModel.find.mock.calls[0];
    expect(filter).not.toHaveProperty("user");
  });

  test("`user` filtri scope'ni BUZMAYDI — ikkisi ham qo'llanadi", async () => {
    const chain = createChain([]);
    TeacherProfileModel.find = jest.fn().mockReturnValue(chain);

    await Controller.findAllProfiles(
      { query: { user: USER_ID }, scope: { department: "dep-1" } },
      createRes(),
      jest.fn(),
    );

    const [filter] = TeacherProfileModel.find.mock.calls[0];
    expect(filter).toMatchObject({
      active: true,
      department: "dep-1",
      user: USER_ID,
    });
  });
});
