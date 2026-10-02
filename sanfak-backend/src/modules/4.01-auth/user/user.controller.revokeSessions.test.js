jest.mock("./user.model");
jest.mock("#modules/4.01-auth/auth/auth.service", () => ({
  revokeAllSessions: jest.fn(),
}));
jest.mock("#modules/4.01-auth/_shared/escalationGuard", () => ({
  assertCanAssignRole: jest.fn(),
  assertUserEditable: jest.fn(),
}));

const { createMockReq, createMockRes, createMockNext } = require("../../../../test/helpers/mockResponse");
const authService = require("#modules/4.01-auth/auth/auth.service");
const { assertUserEditable } = require("#modules/4.01-auth/_shared/escalationGuard");
const Controller = require("./user.controller");

beforeEach(() => {
  jest.clearAllMocks();
  assertUserEditable.mockResolvedValue(undefined);
});

describe("user.controller — revokeSessions", () => {
  test("muvaffaqiyatli → 200 { message, tokenVersion }, escalation guard chaqiriladi", async () => {
    authService.revokeAllSessions.mockResolvedValue(4);
    const req = createMockReq({ params: { id: "target1" }, user: { _id: "actor1" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.revokeSessions(req, res, next);

    expect(assertUserEditable).toHaveBeenCalledWith(req.user, "target1");
    expect(authService.revokeAllSessions).toHaveBeenCalledWith("target1", "admin:actor1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Barcha sessiyalar yopildi",
      tokenVersion: 4,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("o'z-o'ziga qo'llash mumkin (self-revoke)", async () => {
    authService.revokeAllSessions.mockResolvedValue(1);
    const req = createMockReq({ params: { id: "actor1" }, user: { _id: "actor1" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.revokeSessions(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("nishon super_admin/admin (break-glass) → escalation guard 403 bilan rad etadi, service chaqirilmaydi", async () => {
    const err = new Error(
      '"super_admin" rolidagi foydalanuvchini o\'zgartirish uchun super_admin huquqi kerak',
    );
    err.statusCode = 403;
    assertUserEditable.mockRejectedValue(err);

    const req = createMockReq({ params: { id: "adminUser" }, user: { _id: "actor1" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.revokeSessions(req, res, next);

    expect(authService.revokeAllSessions).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  test("foydalanuvchi topilmasa (revokeAllSessions null qaytaradi) → 404", async () => {
    authService.revokeAllSessions.mockResolvedValue(null);
    const req = createMockReq({ params: { id: "noexist" }, user: { _id: "actor1" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.revokeSessions(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("service kutilmagan xato tashlasa → next(ErrorHandler 400)", async () => {
    authService.revokeAllSessions.mockRejectedValue(new Error("DB uzildi"));
    const req = createMockReq({ params: { id: "target1" }, user: { _id: "actor1" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.revokeSessions(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });
});
