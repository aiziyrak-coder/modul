jest.mock("./user.model");
jest.mock("./user.service");
jest.mock("#modules/4.01-auth/_shared/escalationGuard", () => ({
  assertCanAssignRole: jest.fn().mockResolvedValue(undefined),
  assertUserEditable: jest.fn().mockResolvedValue(undefined),
  assertCanChangePin: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.03-teacher/teacher/teacher.model", () => ({ exists: jest.fn() }));

const fs = require("fs");
const path = require("path");
const UserModel = require("./user.model");
const Controller = require("./user.controller");

const USER_ID = "507f1f77bcf86cd799439022";
const UPLOADS = path.resolve(process.cwd(), "uploads");

const run = async (storedPath) => {
  UserModel.findById.mockResolvedValue({
    degrees: { bachelorDegree: [{ _id: { toString: () => "f1" }, path: storedPath }] },
  });
  UserModel.findByIdAndUpdate.mockResolvedValue({ _id: USER_ID });
  const req = { user: { _id: "a", role: { title: "moderator" } }, body: { userId: USER_ID, degreeType: "bachelorDegree", fileId: "f1" } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await Controller.deleteFile(req, res, next);
  return { res, next };
};

let existsSpy;
let unlinkSpy;
beforeEach(() => {
  jest.clearAllMocks();
  existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
  unlinkSpy = jest.spyOn(fs, "unlinkSync").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("deleteFile — uploads chegarasi (path traversal)", () => {
  test("oddiy yo'l — uploads ichidagi fayl o'chiriladi", async () => {
    const { res } = await run("http://host/files/degrees/diplom.pdf");
    expect(unlinkSpy).toHaveBeenCalledWith(path.join(UPLOADS, "degrees", "diplom.pdf"));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test.each([
    ["../.env", "/files/../.env"],
    ["chuqur ..", "/files/degrees/../../src/index.js"],
    ["mutlaq yo'l", "/files//etc/passwd"],
    ["/files/ yo'q", "C:/Windows/win.ini"],
  ])("%s — fayl TEGILMAYDI, yozuv baribir olinadi", async (_n, stored) => {
    const { res } = await run(stored);
    expect(unlinkSpy).not.toHaveBeenCalled();
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
