jest.mock("./auth.service", () => ({
  loginWithCredentials: jest.fn(),
}));
jest.mock("../_loginLock/loginLock.service", () => ({
  LOCK_POLICY: { MAX_FAILED_ATTEMPTS: 8, WINDOW_MS: 900000, LOCK_MS: 1800000 },
  registerFailure: jest.fn(),
  clearFailures: jest.fn(),
}));
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#shared/eImzo", () => ({}));

const authService = require("./auth.service");
const loginLock = require("../_loginLock/loginLock.service");
const Controller = require("./auth.controller");
const {
  createMockReq,
  createMockRes,
  createMockNext,
} = require("../../../../test/helpers/mockResponse");

const PIN = "31234567890123";
const IP = "203.0.113.44";

const runLogin = async () => {
  const req = createMockReq({ body: { oneIdPin: PIN }, user: undefined, ip: IP });
  const res = createMockRes();
  const next = createMockNext();
  await Controller.oneIdLogin(req, res, next);
  return { req, res, next };
};

beforeEach(() => {
  jest.clearAllMocks();
  loginLock.clearFailures.mockResolvedValue(undefined);
  loginLock.registerFailure.mockResolvedValue({
    locked: false,
    justLocked: false,
  });
});

describe("auth.controller — doimiy qulf bilan bog'lanish", () => {
  test("muvaffaqiyatli login hisoblagichni tozalaydi", async () => {
    authService.loginWithCredentials.mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      user: { _id: "u1", firstName: "Ali", lastName: "Valiyev" },
    });

    const { res } = await runLogin();

    expect(loginLock.clearFailures).toHaveBeenCalledWith(IP, PIN);
    expect(loginLock.registerFailure).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("muvaffaqiyatsiz login urinishni qayd etadi", async () => {
    authService.loginWithCredentials.mockRejectedValue(
      Object.assign(new Error("yo'q"), { statusCode: 401 }),
    );

    const { next } = await runLogin();

    expect(loginLock.registerFailure).toHaveBeenCalledWith(IP, PIN);
    expect(loginLock.clearFailures).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test("chegaraga yetilganda qulf hodisasi AUDIT yozuviga tushadi", async () => {
    authService.loginWithCredentials.mockRejectedValue(
      Object.assign(new Error("yo'q"), { statusCode: 401 }),
    );
    loginLock.registerFailure.mockResolvedValue({
      locked: true,
      justLocked: true,
      lockedUntil: new Date("2026-08-21T10:30:00.000Z"),
    });

    const { req } = await runLogin();

    expect(req.auditUser.name).toContain("****0123");
    expect(req.auditUser.name).toContain("HISOB QULFLANDI (30 daq)");
    expect(req.auditUser.name).not.toContain(PIN);
  });

  test("qulf servisidagi nosozlik login javobini buzmaydi (best-effort)", async () => {
    authService.loginWithCredentials.mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      user: { _id: "u1" },
    });
    loginLock.clearFailures.mockRejectedValue(new Error("Mongo topilmadi"));

    const { res, next } = await runLogin();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
