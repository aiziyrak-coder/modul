jest.mock("./teacher.model");

const TeacherProfileModel = require("./teacher.model");
const Controller = require("./teacher.controller");

const DOC_ID = "cccccccccccccccccccccccc";

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

const EXPECTED_USER_SELECT =
  "firstName lastName middleName photo phone email degrees";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("populate('user', ...) — degrees/photo/phone/email tushib qolmasin", () => {
  test("findAllProfiles — user populate select'ida degrees bor", async () => {
    const chain = createChain([]);
    TeacherProfileModel.find = jest.fn().mockReturnValue(chain);

    await Controller.findAllProfiles(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    expect(chain.populate).toHaveBeenCalledWith("user", EXPECTED_USER_SELECT);
  });

  test("findOneProfile — user populate select'ida degrees bor", async () => {
    const chain = createChain({ _id: DOC_ID, user: { _id: "u1" } });
    TeacherProfileModel.findOne = jest.fn().mockReturnValue(chain);

    await Controller.findOneProfile(
      { params: { id: DOC_ID }, scope: {}, user: { _id: "u1" } },
      createRes(),
      jest.fn(),
    );

    expect(chain.populate).toHaveBeenCalledWith("user", EXPECTED_USER_SELECT);
  });

  test("paginateProfiles — populate options ro'yxatida user select'i degrees bilan", async () => {
    TeacherProfileModel.paginate = jest
      .fn()
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    await Controller.paginateProfiles(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    const options = TeacherProfileModel.paginate.mock.calls[0][1];
    const userPopulate = options.populate.find((p) => p.path === "user");
    expect(userPopulate.select).toBe(EXPECTED_USER_SELECT);
  });

  test("paginateProfiles — `updatedAt` projection'dan KESILMAYDI", async () => {
    TeacherProfileModel.paginate = jest
      .fn()
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    await Controller.paginateProfiles(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    const { select } = TeacherProfileModel.paginate.mock.calls[0][1];
    expect(select).not.toMatch(/-updatedAt/);
  });
});
