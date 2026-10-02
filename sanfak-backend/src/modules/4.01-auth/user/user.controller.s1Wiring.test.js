jest.mock("./user.model");
jest.mock("./user.service");
jest.mock("#modules/4.01-auth/_shared/escalationGuard", () => ({
  assertCanAssignRole: jest.fn().mockResolvedValue(undefined),
  assertUserEditable: jest.fn().mockResolvedValue(undefined),
  assertCanChangePin: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.03-teacher/teacher/teacher.model", () => ({ exists: jest.fn() }));

const { ErrorHandler } = require("#shared/error");
const {
  createMockReq,
  createMockRes,
  createMockNext,
} = require("../../../../test/helpers/mockResponse");
const Guard = require("#modules/4.01-auth/_shared/escalationGuard");
const UserModel = require("./user.model");
const Controller = require("./user.controller");

const TARGET_ID = "507f1f77bcf86cd799439022";
const ACTOR = { _id: "507f1f77bcf86cd799439011", role: { title: "kadrlar", permissions: [] } };

const call = async (handler, { params = {}, body = {} } = {}) => {
  const req = createMockReq({ params, body });
  req.user = ACTOR;
  const res = createMockRes();
  const next = createMockNext();
  await Controller[handler](req, res, next);
  return { res, next };
};

const forbid = (fn) => fn.mockRejectedValueOnce(new ErrorHandler(403, "taqiq"));

beforeEach(() => {
  jest.clearAllMocks();
  UserModel.findByIdAndUpdate.mockResolvedValue({ _id: TARGET_ID });
});

describe("update — PIN almashtirish guardi ulangan", () => {
  test("so'rovdagi oneIdPin guardga beriladi", async () => {
    await call("update", { params: { id: TARGET_ID }, body: { oneIdPin: "12345678901234" } });
    expect(Guard.assertCanChangePin).toHaveBeenCalledWith(ACTOR, TARGET_ID, "12345678901234");
  });

  test("guard rad etsa — 403 o'tadi, yozuv YO'Q", async () => {
    forbid(Guard.assertCanChangePin);
    const { next } = await call("update", { params: { id: TARGET_ID }, body: { oneIdPin: "1" } });
    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe("updateProfessor / deleteFile — nishon guardi ulangan", () => {
  test("updateProfessor: guard rad etsa — 403, yozuv YO'Q", async () => {
    forbid(Guard.assertUserEditable);
    const { next } = await call("updateProfessor", { params: { id: TARGET_ID }, body: { firstName: "X" } });
    expect(Guard.assertUserEditable).toHaveBeenCalledWith(ACTOR, TARGET_ID);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("deleteFile: body'dagi userId guardga beriladi; rad etsa — 403, hech narsa o'chmaydi", async () => {
    forbid(Guard.assertUserEditable);
    const body = { userId: TARGET_ID, degreeType: "bachelorDegree", fileId: "f1" };
    const { next } = await call("deleteFile", { body });
    expect(Guard.assertUserEditable).toHaveBeenCalledWith(ACTOR, TARGET_ID);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(UserModel.findById).not.toHaveBeenCalled();
    expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
