jest.mock("./user.model");
jest.mock("./user.service");

const { createMockReq, createMockRes, createMockNext } = require("../../../../test/helpers/mockResponse");
const UserModel = require("./user.model");
const Controller = require("./user.controller");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("user.controller — findAll proyeksiyasi", () => {
  test("UserModel.find `tokenVersion: 0` proyeksiyasi bilan chaqiriladi", async () => {
    const populateChain = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    UserModel.find.mockReturnValue(populateChain);
    const req = createMockReq({ query: {} });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.findAll(req, res, next);

    expect(UserModel.find).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ tokenVersion: 0 }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("user.controller — paginate proyeksiyasi", () => {
  test("UserModel.paginate `select` massivida `-tokenVersion` bor", async () => {
    UserModel.paginate.mockResolvedValue({ docs: [], totalDocs: 0 });
    const req = createMockReq({ query: {} });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.paginate(req, res, next);

    expect(UserModel.paginate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        select: expect.arrayContaining(["-tokenVersion"]),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("user.controller — findOne proyeksiyasi", () => {
  test("UserModel.findById `tokenVersion: 0` proyeksiyasi bilan chaqiriladi", async () => {
    const populateChain = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: "u1" }),
    };
    UserModel.findById.mockReturnValue(populateChain);
    const req = createMockReq({ params: { id: "u1" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.findOne(req, res, next);

    expect(UserModel.findById).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ tokenVersion: 0 }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
