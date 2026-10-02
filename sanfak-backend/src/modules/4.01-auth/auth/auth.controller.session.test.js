jest.mock("./auth.service", () => ({
  revokeAllSessions: jest.fn(),
}));
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#shared/eImzo", () => ({}));

const service = require("./auth.service");
const Controller = require("./auth.controller");
const {
  createMockReq,
  createMockRes,
  createMockNext,
} = require("../../../../test/helpers/mockResponse");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("auth.controller — logout (WP-C · C2-BE)", () => {
  test("logout → revokeAllSessions(userId, 'logout') chaqiradi, joriy sessiyaga cheklanmaydi", async () => {
    service.revokeAllSessions.mockResolvedValue(3);
    const req = createMockReq({ user: { _id: "u1" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.logout(req, res, next);

    expect(service.revokeAllSessions).toHaveBeenCalledWith("u1", "logout");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("revokeAllSessions xato tashlasa → next(ErrorHandler)", async () => {
    service.revokeAllSessions.mockRejectedValue(new Error("DB xato"));
    const req = createMockReq({ user: { _id: "u1" } });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.logout(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });
});

describe("auth.controller — getProfile (ADR-022 shart #1: tokenVersion javobga chiqmaydi)", () => {
  test("tokenVersion req.user'da bo'lsa ham javobda YO'Q", async () => {
    const req = createMockReq({
      user: {
        toObject: () => ({
          _id: "u1",
          firstName: "Ali",
          tokenVersion: 4,
          role: { title: "oqituvchi", permissions: [] },
        }),
      },
    });
    const res = createMockRes();
    const next = createMockNext();

    await Controller.getProfile(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body).not.toHaveProperty("tokenVersion");
    expect(body.firstName).toBe("Ali");
  });
});
